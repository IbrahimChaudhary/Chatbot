import { ObjectId } from "mongodb";

export interface Product {
  _id: ObjectId;
  name: string;
  category: string;
  price: number;
  createdAt: Date;
}

export interface SalesTransaction {
  _id: ObjectId;
  transactionDate: Date;
  product: {
    id: ObjectId;
    name: string;
    category: string;
  };
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  customerSegment: string;
  region: string;
  createdAt: Date;
}

export interface DocumentEmbedding {
  _id: ObjectId;
  content: string;
  embedding: number[] | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
}

// Query result shapes — unchanged
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