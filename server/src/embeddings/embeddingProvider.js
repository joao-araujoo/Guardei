import { GoogleGenAI } from "@google/genai";
import { createLocalEmbedding, LOCAL_EMBEDDING_DIMENSIONS, LOCAL_EMBEDDING_MODEL } from "./localEmbedding.js";

export async function generateEmbedding(text, options = {}) {
  const provider = options.provider || process.env.EMBEDDING_PROVIDER || "local";
  if (provider === "gemini" && process.env.GEMINI_API_KEY) {
    try {
      const model = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
      const client = options.client || new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await withTimeout(client.models.embedContent({ model, contents: text }), 15_000, "EMBEDDING_TIMEOUT");
      const vector = response?.embeddings?.[0]?.values || response?.embedding?.values;
      if (!Array.isArray(vector) || !vector.length) throw embeddingError("EMBEDDING_INVALID_RESPONSE");
      return { provider: "gemini", model, dimensions: vector.length, vector: vector.map(Number) };
    } catch (error) {
      if (options.allowFallback === false) throw error;
    }
  }

  const vector = createLocalEmbedding(text, LOCAL_EMBEDDING_DIMENSIONS);
  return { provider: "local", model: LOCAL_EMBEDDING_MODEL, dimensions: vector.length, vector };
}

function withTimeout(promise, timeoutMs, code) {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(embeddingError(code)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function embeddingError(code) {
  const error = new Error("Nao foi possivel gerar o embedding.");
  error.code = code;
  return error;
}
