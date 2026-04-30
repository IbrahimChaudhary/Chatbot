import { OpenAIEmbedding } from "@llamaindex/openai";

export function getEmbeddingModel() {
  return new OpenAIEmbedding({
    apiKey: process.env.GOOGLE_API_KEY,
    model: "text-embedding-3-small",
    baseURL: "https://openrouter.ai/api/v1",
  });
}