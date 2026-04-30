import { getDb } from "@/lib/mongodb/client";
import type {
  SalesTransaction,
  SalesTrend,
  SalesSummary,
} from "@/lib/types/database";

function buildMatchStage(filters?: {
  category?: string;
  region?: string;
  customer_segment?: string;
  startDate?: string;
  endDate?: string;
}): Record<string, any> {
  const match: Record<string, any> = {};

  if (filters?.category) match["product.category"] = filters.category;
  if (filters?.region) match.region = filters.region;
  if (filters?.customer_segment) match.customerSegment = filters.customer_segment;

  if (filters?.startDate || filters?.endDate) {
    match.transactionDate = {};
    if (filters.startDate) match.transactionDate.$gte = new Date(filters.startDate);
    if (filters.endDate) match.transactionDate.$lte = new Date(filters.endDate);
  }

  return match;
}

export async function getSalesTransactions(
  limit: number = 100,
  filters?: {
    category?: string;
    region?: string;
    customer_segment?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<SalesTransaction[]> {
  const db = await getDb();
  const match = buildMatchStage(filters);

  const docs = await db
    .collection("sales_transactions")
    .find(match)
    .sort({ transactionDate: -1 })
    .limit(limit)
    .toArray();

  return docs as unknown as SalesTransaction[];
}

export async function getSalesTrend(
  category?: string,
  region?: string,
  months: number = 12
): Promise<SalesTrend[]> {
  const db = await getDb();

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const match: Record<string, any> = {
    transactionDate: { $gte: startDate },
  };
  if (category) match["product.category"] = category;
  if (region) match.region = region;

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$transactionDate" } },
        revenue: { $sum: "$totalAmount" },
        transaction_count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        month: "$_id",
        revenue: { $round: ["$revenue", 2] },
        transaction_count: 1,
      },
    },
  ];

  return db
    .collection("sales_transactions")
    .aggregate<SalesTrend>(pipeline)
    .toArray();
}

export async function getSalesSummary(limit: number = 50): Promise<SalesSummary[]> {
  const db = await getDb();

  const pipeline = [
    {
      $group: {
        _id: {
          month: { $dateToString: { format: "%Y-%m", date: "$transactionDate" } },
          category: "$product.category",
          region: "$region",
          customer_segment: "$customerSegment",
        },
        transaction_count: { $sum: 1 },
        total_units_sold: { $sum: "$quantity" },
        total_revenue: { $sum: "$totalAmount" },
        avg_transaction_value: { $avg: "$totalAmount" },
      },
    },
    {
      $project: {
        _id: 0,
        month: "$_id.month",
        category: "$_id.category",
        region: "$_id.region",
        customer_segment: "$_id.customer_segment",
        transaction_count: 1,
        total_units_sold: 1,
        total_revenue: { $round: ["$total_revenue", 2] },
        avg_transaction_value: { $round: ["$avg_transaction_value", 2] },
      },
    },
    { $sort: { month: -1, total_revenue: -1 } },
    { $limit: limit },
  ];

  return db
    .collection("sales_transactions")
    .aggregate<SalesSummary>(pipeline)
    .toArray();
}

export async function getTotalRevenue(filters?: {
  category?: string;
  region?: string;
  startDate?: string;
  endDate?: string;
}): Promise<number> {
  const db = await getDb();
  const match = buildMatchStage(filters);

  const result = await db
    .collection("sales_transactions")
    .aggregate<{ total: number }>([
      { $match: match },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ])
    .toArray();

  return result[0]?.total ?? 0;
}

export async function getCategoryBreakdown(filters?: {
  startDate?: string;
  endDate?: string;
}): Promise<{ name: string; value: number }[]> {
  const db = await getDb();
  const match = buildMatchStage(filters);

  return db
    .collection("sales_transactions")
    .aggregate<{ name: string; value: number }>([
      { $match: match },
      { $group: { _id: "$product.category", value: { $sum: "$totalAmount" } } },
      { $project: { _id: 0, name: "$_id", value: { $round: ["$value", 2] } } },
      { $sort: { value: -1 } },
    ])
    .toArray();
}

export async function getRegionalSales(filters?: {
  startDate?: string;
  endDate?: string;
}): Promise<{ name: string; value: number }[]> {
  const db = await getDb();
  const match = buildMatchStage(filters);

  return db
    .collection("sales_transactions")
    .aggregate<{ name: string; value: number }>([
      { $match: match },
      { $group: { _id: "$region", value: { $sum: "$totalAmount" } } },
      { $project: { _id: 0, name: "$_id", value: { $round: ["$value", 2] } } },
      { $sort: { value: -1 } },
    ])
    .toArray();
}