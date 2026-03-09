"use client";

import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { SalesChart } from "@/components/charts/sales-chart";
import type { ChartData } from "@/lib/types/database";

interface MessageProps {
  role: "user" | "assistant";
  content: string;
}

export function Message({ role, content }: MessageProps) {
  const isUser = role === "user";

  // Extract chart blocks from content (flexible whitespace)
  const chartRegex = /```chart\s*([\s\S]*?)```/g;
  const charts: ChartData[] = [];
  let textContent = content;

  // First, extract charts
  let match;
  while ((match = chartRegex.exec(content)) !== null) {
    try {
      const jsonContent = match[1].trim();
      const chartData = JSON.parse(jsonContent);
      charts.push(chartData);
      // Remove chart block from text content
      textContent = textContent.replace(match[0], "");
    } catch (error) {
      console.error("Failed to parse chart:", error);
    }
  }

  // Determine if this message has charts (affects cleaning strategy)
  const hasCharts = charts.length > 0;

  // Clean up technical artifacts (always applied)
  textContent = textContent
    // Remove code fence markers (```chart, ```, etc.)
    .replace(/```\w*/g, '')
    // Remove hash symbols (markdown headers)
    .replace(/#{1,6}\s*/g, '')
    // Remove markdown bold/italic markers
    .replace(/\*\*|__|\*|_/g, '')
    // Remove entire JSON objects (even multi-line)
    .replace(/\{[^{}]*"(?:type|title|data|xKey|yKey|name|value|month|revenue|category|region|amount|transaction)"[^{}]*\}/g, '')
    // Remove JSON arrays
    .replace(/\[[^\[\]]*\{[^\}]*"(?:month|revenue|name|value|category)"[^\}]*\}[^\[\]]*\]/g, '')
    // Remove key-value pairs like "month": "value" or "data": "xyz"
    .replace(/"(?:month|revenue|name|value|category|region|amount|transaction|date|type|title|data|xKey|yKey)":\s*"[^"]*"/g, '')
    .replace(/"(?:month|revenue|name|value|category|region|amount|transaction|date|type|title|data|xKey|yKey)":\s*\d+\.?\d*/g, '')
    // Remove any remaining "key": pattern (catches "data": etc.)
    .replace(/"\w+":\s*/g, '')
    // Remove chart type specifications
    .replace(/\b(?:line_chart|bar_chart|pie_chart|area_chart|scatter_chart)\b/gi, '')
    // Remove technical terms
    .replace(/\b(?:_type|chartType|dataType|xAxis|yAxis)\b/g, '')
    // Remove curly braces and brackets left behind
    .replace(/[{}\[\]]/g, '')
    // Remove extra quotes
    .replace(/"{2,}/g, '')
    // Remove standalone quotes
    .replace(/\s+"\s+/g, ' ')
    .replace(/^"\s*/g, '')
    .replace(/\s*"$/g, '')
    // Remove commas not followed by a space and letter (leftover JSON commas)
    .replace(/,(?!\s[a-zA-Z])/g, '')
    // Collapse multiple spaces
    .replace(/\s{2,}/g, ' ')
    // Remove extra punctuation
    .replace(/[,;]\s*[,;]/g, ',')
    // Clean up sentence fragments
    .replace(/^\s*[,;:]\s*/g, '')
    .trim();

  // ONLY if there are charts: Remove raw numbers/dates (chart shows them)
  if (hasCharts) {
    textContent = textContent
      // Remove standalone quoted values with dates (like "Mar '25", "Oct 25")
      .replace(/"[A-Z][a-z]{2,9}\s*'?\d{2,4}"[,\s]*/g, '')
      // Remove isolated large numbers that are likely raw data points
      .replace(/\b\d{5,}(?:\.\d+)?\b/g, '')
      // Remove date patterns like "6-01", "26-02" (chart axis labels)
      .replace(/\b\d{1,2}-\d{2}\b/g, '')
      // Clean up any leftover artifacts
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  return (
    <div
      className={cn(
        "flex gap-3 p-4 rounded-lg",
        isUser ? "bg-muted ml-12" : "bg-card mr-12"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className="flex-1 space-y-4 overflow-hidden">
        {/* Render text content */}
        {textContent.trim() && (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
                code: ({ className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || "");
                  return match ? (
                    <code className="block bg-muted p-2 rounded text-sm overflow-x-auto" {...props}>
                      {children}
                    </code>
                  ) : (
                    <code className="bg-muted px-1 py-0.5 rounded text-sm" {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {textContent}
            </ReactMarkdown>
          </div>
        )}

        {/* Render charts */}
        {charts.map((chartData, index) => (
          <div key={index} className="my-4">
            <SalesChart chartData={chartData} />
          </div>
        ))}
      </div>
    </div>
  );
}
