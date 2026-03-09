/**
 * AI Function Calling Tool Definitions
 * Industry-standard approach for parameter extraction
 */

export const salesDataTool = {
  type: "function" as const,
  function: {
    name: "get_sales_data",
    description: "Retrieve sales data from the database with optional filters for category, region, customer segment, and date range. Use this when users ask for specific filtered data.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["Electronics", "Furniture", "Stationery"],
          description: "Product category to filter by"
        },
        region: {
          type: "string",
          enum: ["North America", "Europe", "Asia Pacific", "Latin America"],
          description: "Geographic region to filter by"
        },
        customer_segment: {
          type: "string",
          enum: ["Enterprise", "SMB", "Individual", "Education"],
          description: "Customer segment to filter by"
        },
        startDate: {
          type: "string",
          description: "Start date for filtering in YYYY-MM-DD format. For quarters: Q1 = Jan 1, Q2 = Apr 1, Q3 = Jul 1, Q4 = Oct 1"
        },
        endDate: {
          type: "string",
          description: "End date for filtering in YYYY-MM-DD format. For quarters: Q1 = Mar 31, Q2 = Jun 30, Q3 = Sep 30, Q4 = Dec 31"
        },
        months: {
          type: "number",
          description: "Number of months to look back for trend analysis (default: 12)"
        },
        dataType: {
          type: "string",
          enum: ["trend", "category_breakdown", "regional_sales", "transactions", "total_revenue"],
          description: "Type of data to retrieve: trend for time series, category_breakdown for pie charts, regional_sales for geographic analysis, transactions for detailed records, total_revenue for summary"
        }
      },
      required: [] // All parameters optional for flexibility
    }
  }
};

export const tools = [salesDataTool];

/**
 * Parse tool call arguments safely
 */
export function parseToolArguments(argsString: string): any {
  try {
    return JSON.parse(argsString);
  } catch (error) {
    console.error("Failed to parse tool arguments:", error);
    return {};
  }
}

/**
 * Generate human-readable description of filters from tool args
 */
export function describeToolFilters(args: any): string {
  const parts: string[] = [];

  if (args.category) parts.push(`Category: ${args.category}`);
  if (args.region) parts.push(`Region: ${args.region}`);
  if (args.customer_segment) parts.push(`Segment: ${args.customer_segment}`);
  if (args.startDate && args.endDate) {
    parts.push(`Period: ${args.startDate} to ${args.endDate}`);
  } else if (args.months) {
    parts.push(`Last ${args.months} months`);
  }

  return parts.length > 0 ? parts.join(" | ") : "All data";
}
