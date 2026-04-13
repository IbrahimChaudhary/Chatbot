import { OpenRouter } from "@openrouter/sdk";
import { tools, parseToolArguments, describeToolFilters } from "@/lib/ai/tools-definition";
import { executeFilteredQuery, executeSemanticQuery } from "@/lib/llamaindex/hybrid-query-refactored";

export const runtime = "nodejs";
export const maxDuration = 30;

const openrouter = new OpenRouter({
  apiKey: process.env.GOOGLE_API_KEY!,
});

const systemPrompt = `You are an AI sales analyst assistant with access to a REAL sales database.

IMPORTANT - DETECT IRRELEVANT QUERIES:
If the user's message is NOT related to sales, data, analytics, forecasts, or business insights (e.g., greetings like "hi", "hello", general questions, or off-topic queries), respond ONLY with a friendly introduction:
"Hello! I'm your AI Sales Analyst Assistant. I can help you analyze sales data, create visualizations, identify trends, and generate forecasts. Try asking me about sales trends, top products, regional performance, or request a chart!"

Do NOT query the database or provide sales data for irrelevant queries.

Database Information:
- Products: Electronics, Furniture, and Stationery categories
- Customers: Enterprise, SMB, Individual, and Education segments
- Regions: North America, Europe, Asia Pacific, and Latin America
- Time period: 2+ years of historical sales data

TOOL USAGE:
When users ask for SPECIFIC FILTERED data (e.g., "Electronics sales in Europe for Q1 2024"), use the get_sales_data tool.
When users ask GENERAL questions (e.g., "What are my best products?"), I will provide semantic search results - do NOT call the tool.

CHART GENERATION:
Charts are AUTOMATICALLY generated when users request visualizations. Keep your text response VERY BRIEF (1-2 sentences).`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const userMessage = messages[messages.length - 1]?.content || "";

    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...messages.slice(0, -1).map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: "user",
        content: userMessage
      },
    ];

    // STEP 1: Initial AI request with function calling capability
    // @ts-ignore
    const initialCompletion = await openrouter.chat.send({
      chatGenerationParams: {
        messages: chatMessages,
        model: "google/gemini-3.1-flash-lite-preview",
        tools: tools,
        toolChoice: "auto", // Let AI decide whether to use tools
        maxTokens: 2048,
      },
    });

    console.log("Initial AI response:", JSON.stringify(initialCompletion, null, 2).substring(0, 500));

    // STEP 2: Check if query is irrelevant (greetings, off-topic)
    const irrelevantPatterns = /^(hi|hello|hey|greetings|good morning|good afternoon|good evening|how are you|what's up|sup|yo|what can you do|help|who are you|what are you)[\s\?\!]*$/i;
    const isIrrelevant = irrelevantPatterns.test(userMessage.trim());

    let dataResult: any = null;
    let queryType: "semantic" | "filtered" = "semantic";
    let filterDescription: string | undefined;

    // Only query database if the query is relevant to sales/data
    if (!isIrrelevant) {
      // STEP 2: Check if AI wants to use the tool
      const choice = initialCompletion.choices?.[0];
      const toolCalls = choice?.message?.toolCalls;

      if (toolCalls && toolCalls.length > 0) {
        // AI decided to use the tool - execute filtered query
        console.log("AI decided to call tool - using FILTERED query");
        queryType = "filtered";

        const toolCall = toolCalls[0];
        const toolArgs = parseToolArguments(toolCall.function.arguments);

        console.log("Tool arguments extracted by AI:", toolArgs);

        // Execute filtered query with AI-extracted parameters
        dataResult = await executeFilteredQuery(toolArgs);
        filterDescription = describeToolFilters(toolArgs);
      } else {
        // AI didn't call tool - use semantic search
        console.log("AI didn't call tool - using SEMANTIC search");
        dataResult = await executeSemanticQuery(userMessage);
      }
    } else {
      console.log("Irrelevant query detected - skipping database query");
    }

    // STEP 3: Build context message with data
    const isChartRequest = /\b(visual|chart|graph|show me|display|plot|visualiz)/i.test(userMessage);

    let contextMessage = "";

    // Only add database context if we have data
    if (dataResult) {
      contextMessage = "\n\n=== DATABASE DATA ===\n";

      if (queryType === "filtered" && filterDescription) {
        contextMessage += `Query Type: FILTERED (${filterDescription})\n`;
      } else {
        contextMessage += `Query Type: SEMANTIC SEARCH\n`;
      }

      contextMessage += `Data Sources: ${dataResult.sources.join(", ")}\n\n`;
      contextMessage += JSON.stringify(dataResult.relevantData, null, 2);
      contextMessage += "\n\n";

      if (isChartRequest) {
        contextMessage += "=== CRITICAL INSTRUCTIONS ===\n";
        contextMessage += "A chart is being AUTOMATICALLY generated. DO NOT describe the chart or data.\n\n";
        contextMessage += "Your response MUST:\n";
        contextMessage += "- Be 1-2 sentences MAXIMUM\n";
        contextMessage += "- Give ONLY high-level business insight\n";
        contextMessage += "- Use plain conversational English\n\n";
        contextMessage += "NEVER include:\n";
        contextMessage += "- Numbers, percentages, or values\n";
        contextMessage += "- Month names or dates\n";
        contextMessage += "- JSON, code, or technical syntax\n";
        contextMessage += "- Markdown symbols (#, ```, -, *)\n";
        contextMessage += "- Chart specifications (type, xKey, yKey, etc.)\n";
        contextMessage += "- Raw data or array contents\n\n";
        contextMessage += "GOOD: 'The trend shows steady progress with opportunities for growth.'\n";
        contextMessage += "BAD: 'March 2025 had revenue of $461300' or '```chart' or any technical details.\n";
      } else {
        contextMessage += "Analyze this data and provide insights.";
      }
    } else {
      // For irrelevant queries, just ask AI to respond appropriately
      contextMessage = "\n\nThis query is not related to sales or data analysis. Provide your introduction as instructed in the system prompt.";
    }

    // STEP 4: Send data back to AI for final response (with streaming)
    const finalMessages = [
      ...chatMessages,
      {
        role: "user",
        content: contextMessage
      }
    ];

    // @ts-ignore
    const finalCompletion = await openrouter.chat.send({
      chatGenerationParams: {
        messages: finalMessages,
        model: "google/gemini-3.1-flash-lite-preview",
        maxTokens: 2048,
        stream: true,
      },
    });

    // STEP 5: Stream the response
    const encoder = new TextEncoder();
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Stream AI response
          // @ts-ignore
          for await (const chunk of finalCompletion) {
            const text = chunk.choices?.[0]?.delta?.content || "";
            if (text) {
              fullResponse += text;
              controller.enqueue(encoder.encode(`0:"${text}"\n`));
            }
          }

          // STEP 6: Add chart if requested
          if (isChartRequest && dataResult?.relevantData) {
            console.log("Chart requested - adding chart block");

            let chartData: any = null;

            // Priority 1: Regional sales (pie chart)
            if (dataResult.relevantData.regional_sales) {
              chartData = {
                type: "pie",
                title: filterDescription
                  ? `Regional Sales - ${filterDescription}`
                  : "Regional Sales Distribution",
                data: dataResult.relevantData.regional_sales
              };
            }
            // Priority 2: Category breakdown (pie chart)
            else if (dataResult.relevantData.category_breakdown) {
              chartData = {
                type: "pie",
                title: filterDescription
                  ? `Sales by Category - ${filterDescription}`
                  : "Sales by Category",
                data: dataResult.relevantData.category_breakdown
              };
            }
            // Priority 3: Sales trend (line chart)
            else if (dataResult.relevantData.sales_trend) {
              chartData = {
                type: "line",
                title: filterDescription
                  ? `Revenue Trend - ${filterDescription}`
                  : "Revenue Trend",
                data: dataResult.relevantData.sales_trend,
                xKey: "month",
                yKey: "revenue"
              };
            }

            if (chartData) {
              const chartBlock = "\n\n```chart\n" + JSON.stringify(chartData, null, 2) + "\n```";
              controller.enqueue(encoder.encode(`0:${JSON.stringify(chartBlock)}\n`));
              console.log("Chart block sent");
            }
          }

          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("API Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to process request" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
