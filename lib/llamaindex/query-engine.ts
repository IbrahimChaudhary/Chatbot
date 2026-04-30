import { VectorStoreIndex, Document, Settings } from "llamaindex";
import { OpenAI } from "@llamaindex/openai";
import { getEmbeddingModel } from "./embedding";
import {
  getSalesTransactions,
  getSalesTrend,
  getCategoryBreakdown,
} from "@/lib/database/queries";

// Configure LlamaIndex settings
Settings.llm = new OpenAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "google/gemini-3.1-flash-lite-preview",
  maxTokens: 2048, // Limit to reduce credit usage
  additionalSessionOptions: {
    baseURL: "https://openrouter.ai/api/v1",
  },
});

Settings.embedModel = getEmbeddingModel();

/**
 * Creates documents from sales data for indexing
 */
export async function createSalesDocuments() {
  const documents: Document[] = [];

  try {
    // Get sales trend data
    const salesTrend = await getSalesTrend(undefined, undefined, 12);
    if (salesTrend && salesTrend.length > 0) {
      const trendText = `Sales Trend Data (Last 12 Months):\n${salesTrend
        .map(
          (t) =>
            `Month: ${t.month}, Revenue: $${t.revenue}, Transactions: ${t.transaction_count}`,
        )
        .join("\n")}`;

      documents.push(
        new Document({
          text: trendText + "\n\nRAW_DATA:" + JSON.stringify(salesTrend),
          metadata: {
            type: "sales_trend",
            period: "12_months",
            record_count: salesTrend.length,
          },
        }),
      );
    }

    // Get category breakdown
    const categories = await getCategoryBreakdown();
    if (categories && categories.length > 0) {
      const categoryText = `Sales by Category:\n${categories
        .map((c) => `${c.name}: $${c.value}`)
        .join("\n")}`;

      documents.push(
        new Document({
          text: categoryText + "\n\nRAW_DATA:" + JSON.stringify(categories),
          metadata: {
            type: "category_breakdown",
            record_count: categories.length,
          },
        }),
      );
    }

    // Get recent transactions summary
    const transactions = await getSalesTransactions(50);
    if (transactions && transactions.length > 0) {
      const transactionText = `Recent Sales Transactions (${transactions.length} records):\n${transactions
        .slice(0, 10)
        .map(
          (t) =>
            `Date: ${t.transactionDate.toISOString().split("T")[0]}, Product: ${t.product.name}, Amount: $${t.totalAmount}, Region: ${t.region}`,
        )
        .join("\n")}`;

      documents.push(
        new Document({
          text:
            transactionText +
            "\n\nRAW_DATA:" +
            JSON.stringify(transactions.slice(0, 20)),
          metadata: {
            type: "transactions",
            record_count: transactions.length,
          },
        }),
      );
    }

    console.log(`Created ${documents.length} documents for indexing`);
    return documents;
  } catch (error) {
    console.error("Error creating sales documents:", error);
    return [];
  }
}

/**
 * Query the sales data using LlamaIndex
 */
export async function querySalesData(query: string) {
  try {
    // Create documents from current sales data
    const documents = await createSalesDocuments();

    if (documents.length === 0) {
      console.warn("No documents created, falling back to direct queries");
      return null;
    }

    // Create index from documents
    const index = await VectorStoreIndex.fromDocuments(documents);

    // Use retriever instead of query engine to skip LLM synthesis (saves credits!)
    const retriever = index.asRetriever({
      similarityTopK: 3,
    });

    // Retrieve relevant documents based on semantic similarity
    const nodes = await retriever.retrieve(query);

    // Extract data types from matched nodes and re-fetch fresh data
    const matchedTypes = new Set<string>();
    nodes.forEach((nodeWithScore) => {
      const metadata = nodeWithScore.node.metadata;
      if (metadata.type) {
        matchedTypes.add(metadata.type as string);
      }
    });

    console.log("Matched data types:", Array.from(matchedTypes));

    // Re-fetch the exact data based on matched types (avoids JSON truncation issues)
    const relevantData: any = {};
    const sources: string[] = [];
    const typesArray = Array.from(matchedTypes);

    for (const type of typesArray) {
      if (type === "sales_trend") {
        relevantData.sales_trend = await getSalesTrend(
          undefined,
          undefined,
          12,
        );
        sources.push("sales_trend");
      } else if (type === "category_breakdown") {
        relevantData.category_breakdown = await getCategoryBreakdown();
        sources.push("category_breakdown");
      } else if (type === "transactions") {
        relevantData.transactions = await getSalesTransactions(20);
        sources.push("transactions");
      }
    }

    return {
      relevantData,
      sources,
    };
  } catch (error) {
    console.error("Error querying sales data:", error);
    return null;
  }
}
