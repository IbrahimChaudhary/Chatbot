import { SupabaseVectorStore } from "@llamaindex/supabase";
import { OpenAIEmbedding } from "@llamaindex/openai";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseKey);
}

// Create embedding model (using OpenRouter which supports OpenAI-compatible embeddings)
export function getEmbeddingModel() {
  return new OpenAIEmbedding({
    apiKey: process.env.GOOGLE_API_KEY, // OpenRouter key
    model: "text-embedding-3-small",
    baseURL: "https://openrouter.ai/api/v1",
  });
}

// Create vector store instance
export async function getVectorStore() {
  const client = getSupabaseClient();
  const embeddingModel = getEmbeddingModel();

  const vectorStore = new SupabaseVectorStore({
    client,
    table: "document_embeddings",
  });

  return { vectorStore, embeddingModel };
}
