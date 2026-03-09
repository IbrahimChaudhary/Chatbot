import { createClient } from "@/lib/supabase/server";
import type { SalesTransaction, SalesTrend, SalesSummary } from "@/lib/types/database";

export async function getSalesTransactions(
  limit: number = 100,
  filters?: {
    category?: string;
    region?: string;
    customer_segment?: string;
    startDate?: string;
    endDate?: string;
  }
) {
  const supabase = await createClient();

  let query = supabase
    .from("sales_transactions")
    .select("*")
    .order("transaction_date", { ascending: false })
    .limit(limit);

  if (filters?.category) {
    query = query.eq("category", filters.category);
  }
  if (filters?.region) {
    query = query.eq("region", filters.region);
  }
  if (filters?.customer_segment) {
    query = query.eq("customer_segment", filters.customer_segment);
  }
  if (filters?.startDate) {
    query = query.gte("transaction_date", filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte("transaction_date", filters.endDate);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as SalesTransaction[];
}

export async function getSalesTrend(
  category?: string,
  region?: string,
  months: number = 12
) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_sales_trend", {
    p_category: category || null,
    p_region: region || null,
    p_months: months,
  });

  if (error) throw error;
  return data as SalesTrend[];
}

export async function getSalesSummary(limit: number = 50) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sales_summary")
    .select("*")
    .limit(limit);

  if (error) throw error;
  return data as SalesSummary[];
}

export async function getTotalRevenue(filters?: {
  category?: string;
  region?: string;
  startDate?: string;
  endDate?: string;
}) {
  const supabase = await createClient();

  let query = supabase
    .from("sales_transactions")
    .select("total_amount");

  if (filters?.category) {
    query = query.eq("category", filters.category);
  }
  if (filters?.region) {
    query = query.eq("region", filters.region);
  }
  if (filters?.startDate) {
    query = query.gte("transaction_date", filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte("transaction_date", filters.endDate);
  }

  const { data, error } = await query;

  if (error) throw error;

  const total = data?.reduce((sum, item) => sum + Number(item.total_amount), 0) || 0;
  return total;
}

export async function getCategoryBreakdown(filters?: {
  startDate?: string;
  endDate?: string;
}) {
  const supabase = await createClient();

  let query = supabase
    .from("sales_transactions")
    .select("category, total_amount");

  if (filters?.startDate) {
    query = query.gte("transaction_date", filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte("transaction_date", filters.endDate);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Aggregate by category
  const categoryMap = new Map<string, number>();
  data?.forEach((item) => {
    const current = categoryMap.get(item.category) || 0;
    categoryMap.set(item.category, current + Number(item.total_amount));
  });

  return Array.from(categoryMap.entries()).map(([name, value]) => ({
    name,
    value,
  }));
}

export async function getRegionalSales(filters?: {
  startDate?: string;
  endDate?: string;
}) {
  const supabase = await createClient();

  let query = supabase
    .from("sales_transactions")
    .select("region, total_amount");

  if (filters?.startDate) {
    query = query.gte("transaction_date", filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte("transaction_date", filters.endDate);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Aggregate by region
  const regionMap = new Map<string, number>();
  data?.forEach((item) => {
    const current = regionMap.get(item.region) || 0;
    regionMap.set(item.region, current + Number(item.total_amount));
  });

  return Array.from(regionMap.entries()).map(([name, value]) => ({
    name,
    value,
  }));
}
