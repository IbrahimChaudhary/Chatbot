export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  created_at: string;
}

export interface SalesTransaction {
  id: number;
  transaction_date: string;
  product_id: number;
  product_name: string;
  category: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  customer_segment: string;
  region: string;
  created_at: string;
}

export interface DocumentEmbedding {
  id: number;
  content: string;
  embedding: number[] | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface SalesSummary {
  month: string;
  category: string;
  region: string;
  customer_segment: string;
  transaction_count: number;
  total_units_sold: number;
  total_revenue: number;
  avg_transaction_value: number;
}

export interface SalesTrend {
  month: string;
  revenue: number;
  transaction_count: number;
}

export type ChartType = "line" | "bar" | "area" | "pie" | "scatter";

export interface ChartData {
  type: ChartType;
  title: string;
  data: any[];
  xKey?: string;
  yKey?: string;
  description?: string;
}
