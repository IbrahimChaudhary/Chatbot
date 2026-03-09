-- Enable pgvector extension for vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales transactions table
CREATE TABLE IF NOT EXISTS sales_transactions (
  id SERIAL PRIMARY KEY,
  transaction_date DATE NOT NULL,
  product_id INTEGER REFERENCES products(id),
  product_name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  customer_segment TEXT NOT NULL,
  region TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document embeddings table for RAG (Retrieval Augmented Generation)
CREATE TABLE IF NOT EXISTS document_embeddings (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding VECTOR(768), -- Google Gemini embedding dimension
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_sales_category ON sales_transactions(category);
CREATE INDEX IF NOT EXISTS idx_sales_region ON sales_transactions(region);
CREATE INDEX IF NOT EXISTS idx_sales_segment ON sales_transactions(customer_segment);

-- Create HNSW index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON document_embeddings
USING hnsw (embedding vector_cosine_ops);

-- Insert sample products
INSERT INTO products (name, category, price) VALUES
('Laptop Pro 15"', 'Electronics', 1299.99),
('Wireless Mouse', 'Electronics', 29.99),
('Office Chair', 'Furniture', 249.99),
('Standing Desk', 'Furniture', 499.99),
('Notebook Pack', 'Stationery', 12.99),
('Pen Set', 'Stationery', 8.99),
('Monitor 27"', 'Electronics', 349.99),
('Keyboard Mechanical', 'Electronics', 89.99),
('Desk Lamp', 'Furniture', 45.99),
('File Cabinet', 'Furniture', 189.99);

-- Insert sample sales data (2 years of monthly data)
INSERT INTO sales_transactions (transaction_date, product_id, product_name, category, quantity, unit_price, total_amount, customer_segment, region)
SELECT
  date::DATE,
  product_id,
  product_name,
  category,
  quantity,
  unit_price,
  quantity * unit_price AS total_amount,
  customer_segment,
  region
FROM (
  SELECT
    generate_series(
      '2024-01-01'::DATE,
      '2026-02-28'::DATE,
      '1 day'::INTERVAL
    ) AS date,
    p.id AS product_id,
    p.name AS product_name,
    p.category,
    p.price AS unit_price,
    (RANDOM() * 10 + 1)::INTEGER AS quantity,
    (ARRAY['Enterprise', 'SMB', 'Individual', 'Education'])[FLOOR(RANDOM() * 4 + 1)] AS customer_segment,
    (ARRAY['North America', 'Europe', 'Asia Pacific', 'Latin America'])[FLOOR(RANDOM() * 4 + 1)] AS region
  FROM products p
  CROSS JOIN generate_series(1, 3) -- Generate 3 transactions per product per day for variety
  WHERE RANDOM() > 0.7 -- Only generate ~30% of potential transactions for realistic sparsity
) AS sales_data;

-- Insert sample document embeddings for context
INSERT INTO document_embeddings (content, metadata) VALUES
('Our company specializes in office supplies, electronics, and furniture. We serve enterprise, SMB, individual, and education customers across four major regions.',
 '{"type": "company_info", "category": "general"}'),
('Sales typically peak during Q4 (October-December) due to holiday shopping and end-of-year budgets. Q1 shows slower growth as customers recover from holiday spending.',
 '{"type": "sales_pattern", "category": "trends"}'),
('Electronics category shows highest revenue, followed by furniture and stationery. Laptop Pro 15 and Standing Desk are our top sellers.',
 '{"type": "product_performance", "category": "products"}'),
('Enterprise customers contribute 40% of revenue, SMB 30%, Individual 20%, and Education 10%. Enterprise deals are larger but less frequent.',
 '{"type": "customer_insights", "category": "segments"}'),
('North America is our largest market (45%), followed by Europe (30%), Asia Pacific (15%), and Latin America (10%).',
 '{"type": "regional_breakdown", "category": "geography"}');

-- Create a view for quick analytics
CREATE OR REPLACE VIEW sales_summary AS
SELECT
  DATE_TRUNC('month', transaction_date) AS month,
  category,
  region,
  customer_segment,
  COUNT(*) AS transaction_count,
  SUM(quantity) AS total_units_sold,
  SUM(total_amount) AS total_revenue,
  AVG(total_amount) AS avg_transaction_value
FROM sales_transactions
GROUP BY DATE_TRUNC('month', transaction_date), category, region, customer_segment
ORDER BY month DESC, total_revenue DESC;

-- Create a function for sales forecasting data
CREATE OR REPLACE FUNCTION get_sales_trend(
  p_category TEXT DEFAULT NULL,
  p_region TEXT DEFAULT NULL,
  p_months INTEGER DEFAULT 12
)
RETURNS TABLE (
  month DATE,
  revenue DECIMAL,
  transaction_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC('month', transaction_date)::DATE AS month,
    SUM(total_amount) AS revenue,
    COUNT(*) AS transaction_count
  FROM sales_transactions
  WHERE
    (p_category IS NULL OR category = p_category)
    AND (p_region IS NULL OR region = p_region)
    AND transaction_date >= CURRENT_DATE - (p_months || ' months')::INTERVAL
  GROUP BY DATE_TRUNC('month', transaction_date)
  ORDER BY month;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions (if using RLS, adjust accordingly)
-- For now, we'll keep it simple for testing
COMMENT ON TABLE sales_transactions IS 'Stores all sales transaction data for analytics';
COMMENT ON TABLE products IS 'Product catalog';
COMMENT ON TABLE document_embeddings IS 'Vector embeddings for RAG-based chat context';
COMMENT ON VIEW sales_summary IS 'Aggregated sales data by month, category, region, and segment';
COMMENT ON FUNCTION get_sales_trend IS 'Returns sales trend data for forecasting';
