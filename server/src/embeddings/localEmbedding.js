import { normalizeText } from "./embeddingText.js";

export const LOCAL_EMBEDDING_DIMENSIONS = 192;
export const LOCAL_EMBEDDING_MODEL = "semantic-hash-v1";

const CONCEPT_GROUPS = [
  ["auth", "autenticacao", "login", "sessao", "cookie", "jwt", "seguranca", "senha", "oauth"],
  ["interface", "ui", "ux", "design", "layout", "mobile", "responsivo", "acessibilidade"],
  ["saas", "produto", "startup", "venda", "marketing", "cliente", "mrr", "assinatura"],
  ["teste", "testes", "qualidade", "qa", "unitario", "integracao", "e2e"],
  ["deploy", "producao", "infraestrutura", "docker", "cloud", "render", "vercel"],
  ["react", "frontend", "componente", "hooks", "javascript", "vite"],
  ["backend", "api", "node", "express", "banco", "postgres", "prisma"],
  ["rapido", "curto", "almoco", "pouco tempo", "leve"],
  ["cansado", "baixa energia", "sem foco", "leve", "facil"],
  ["projeto", "aplicar", "implementacao", "pratica", "referencia"],
  ["estudo", "aprender", "curso", "prova", "revisao", "fundamentos"],
  ["financas", "dinheiro", "orcamento", "investimento", "economia"],
];

const CANONICAL = new Map();
for (const group of CONCEPT_GROUPS) {
  const canonical = group[0];
  for (const term of group) CANONICAL.set(normalizeText(term).toLowerCase(), canonical);
}

export function createLocalEmbedding(text, dimensions = LOCAL_EMBEDDING_DIMENSIONS) {
  const vector = new Array(dimensions).fill(0);
  const tokens = enrichTokens(tokenize(text));
  for (const token of tokens) {
    const index = stableHash(token) % dimensions;
    const sign = stableHash(`${token}:sign`) % 2 === 0 ? 1 : -1;
    vector[index] += sign * tokenWeight(token);
  }
  return normalizeVector(vector);
}

export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || !a.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let index = 0; index < a.length; index += 1) {
    const av = Number(a[index]) || 0;
    const bv = Number(b[index]) || 0;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  if (!na || !nb) return 0;
  return Math.max(-1, Math.min(1, dot / Math.sqrt(na * nb)));
}

export function tokenize(text) {
  return normalizeText(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token))
    .slice(0, 500);
}

function enrichTokens(tokens) {
  const output = [];
  const seen = new Set();
  for (const token of tokens) {
    const canonical = CANONICAL.get(token) || token;
    for (const value of [token, canonical]) {
      if (!seen.has(value)) output.push(value);
      seen.add(value);
    }
  }
  for (let index = 0; index < tokens.length - 1; index += 1) {
    output.push(`${tokens[index]}_${tokens[index + 1]}`);
  }
  return output;
}

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function tokenWeight(token) {
  if (token.includes("_")) return 1.25;
  if (CANONICAL.has(token)) return 1.4;
  return 1;
}

function normalizeVector(vector) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!norm) return vector;
  return vector.map((value) => Number((value / norm).toFixed(8)));
}

const STOP_WORDS = new Set([
  "a", "o", "as", "os", "um", "uma", "de", "da", "do", "das", "dos", "e", "ou", "em", "no", "na", "nos", "nas",
  "para", "por", "com", "sem", "que", "como", "sobre", "meu", "minha", "meus", "minhas", "se", "eu", "voce", "mais",
  "the", "and", "or", "of", "to", "in", "for", "with", "on", "is", "are",
]);
