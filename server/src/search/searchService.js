import { composeEmbeddingText } from "../embeddings/embeddingText.js";
import { createLocalEmbedding, cosineSimilarity, tokenize } from "../embeddings/localEmbedding.js";
import { createQueryEmbedding, scheduleEmbeddingRefresh } from "../embeddings/embeddingService.js";

const MAX_CANDIDATES = 240;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export function validateSearchParams(raw = {}) {
  const q = cleanString(raw.q, 1_200);
  const limit = clampInteger(raw.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = clampInteger(raw.offset, 0, 0, 5_000);
  const category = cleanEnum(raw.category, null, 80);
  const status = cleanEnum(raw.status, null, 40);
  const platform = cleanEnum(raw.platform, null, 40);
  const mood = cleanEnum(raw.mood, null, 40);
  const duration = cleanEnum(raw.duration, null, 40);
  const priority = cleanEnum(raw.priority, null, 40);
  const hasCapsule = parseBoolean(raw.hasCapsule);
  const mode = ["hybrid", "text"].includes(raw.mode) ? raw.mode : "hybrid";
  return { q, limit, offset, category, status, platform, mood, duration, priority, hasCapsule, mode };
}

export async function hybridSearch({ prisma, userId, params, queryEmbedder = createQueryEmbedding, scheduleRefresh = scheduleEmbeddingRefresh }) {
  const filters = validateSearchParams(params);
  const where = buildWhere(userId, filters);
  const items = await prisma.video.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: MAX_CANDIDATES,
    include: {
      capsule: { select: { id: true, status: true, coverage: true, summary: true, keyPoints: true, concepts: true, generatedAt: true } },
      embedding: true,
    },
  });

  let queryVector = null;
  let semanticAvailable = filters.mode === "hybrid" && Boolean(filters.q);
  if (semanticAvailable) {
    try {
      queryVector = await queryEmbedder(filters.q);
    } catch {
      semanticAvailable = false;
    }
  }

  let scheduledRefreshes = 0;
  const ranked = items.map((item) => {
    const textualScore = calculateTextualScore(item, filters.q);
    let semanticScore = 0;
    let usedStoredEmbedding = false;
    if (semanticAvailable && queryVector) {
      const currentText = composeEmbeddingText(item);
      const storedVector = item.embedding?.status === "indexed" ? asVector(item.embedding.vector) : [];
      const itemVector = storedVector.length === queryVector.length ? storedVector : createLocalEmbedding(currentText, queryVector.length);
      semanticScore = similarityToUnit(cosineSimilarity(queryVector, itemVector));
      usedStoredEmbedding = storedVector.length === queryVector.length;
      if (!usedStoredEmbedding && scheduleRefresh && scheduledRefreshes < 25) {
        scheduledRefreshes += 1;
        scheduleRefresh(prisma, userId, item.id);
      }
    }
    const attributeScore = calculateAttributeScore(item, filters.q);
    const finalScore = calculateHybridScore({ textualScore, semanticScore, attributeScore, semanticAvailable });
    return {
      item,
      textualScore,
      semanticScore: semanticAvailable ? semanticScore : 0,
      attributeScore,
      finalScore,
      reasons: buildReasons(item, filters.q, { textualScore, semanticScore, attributeScore, semanticAvailable }),
      highlights: buildHighlights(item, filters.q),
      semanticAvailable,
      usedStoredEmbedding,
    };
  })
    .filter((entry) => !filters.q || entry.finalScore > 0.03)
    .sort((a, b) => b.finalScore - a.finalScore || new Date(b.item.updatedAt) - new Date(a.item.updatedAt));

  const total = ranked.length;
  const page = ranked.slice(filters.offset, filters.offset + filters.limit).map(serializeSearchResult);
  return {
    query: filters.q,
    mode: semanticAvailable ? "hybrid" : "textual_fallback",
    total,
    limit: filters.limit,
    offset: filters.offset,
    results: page,
  };
}

export function calculateHybridScore({ textualScore, semanticScore, attributeScore, semanticAvailable }) {
  const semanticWeight = semanticAvailable ? 0.52 : 0;
  const textWeight = semanticAvailable ? 0.36 : 0.78;
  const attributeWeight = semanticAvailable ? 0.12 : 0.22;
  return clamp01(textualScore * textWeight + semanticScore * semanticWeight + attributeScore * attributeWeight);
}

export function calculateTextualScore(item, query) {
  const tokens = tokenize(query);
  if (!tokens.length) return 0.45;
  const title = normalize(item.titleCustom || item.titleAi || item.titleOriginal);
  const tags = normalize((item.tags || []).join(" "));
  const category = normalize(item.category);
  const note = normalize(item.note);
  const description = normalize(item.description);
  const summary = normalize(item.summary || item.capsule?.summary);
  const capsuleText = normalize([...asArray(item.capsule?.keyPoints), ...asArray(item.capsule?.concepts)].join(" "));
  let score = 0;
  for (const token of tokens.slice(0, 20)) {
    if (title.includes(token)) score += 0.18;
    if (tags.includes(token)) score += 0.12;
    if (category.includes(token)) score += 0.08;
    if (note.includes(token)) score += 0.08;
    if (description.includes(token)) score += 0.05;
    if (summary.includes(token)) score += 0.1;
    if (capsuleText.includes(token)) score += 0.12;
  }
  const phrase = normalize(query);
  if (phrase.length >= 5 && title.includes(phrase)) score += 0.35;
  if (phrase.length >= 5 && (summary.includes(phrase) || capsuleText.includes(phrase))) score += 0.25;
  return clamp01(score / Math.max(1, Math.min(tokens.length, 5)) * 2.2);
}

export function calculateAttributeScore(item, query) {
  const text = normalize(query);
  let score = 0;
  if (/rapido|curto|almoco|pouco tempo/.test(text) && item.durationBucket === "short") score += 0.45;
  if (/cansado|leve|sem foco|baixa energia/.test(text) && ["leve", "neutro"].includes(item.mood)) score += 0.3;
  if (/foco|aprofundar|estudar/.test(text) && ["focado", "alto"].includes(item.effort)) score += 0.2;
  if ((/importante|prioridade|essencial/.test(text) && item.priority === "alta") || item.status === "importante") score += 0.25;
  if (/aplicar|projeto|pratica/.test(text) && ["aplicado", "importante"].includes(item.status)) score += 0.2;
  if (item.capsule && ["completed", "limited"].includes(item.capsule.status)) score += 0.08;
  return clamp01(score);
}

function buildWhere(userId, filters) {
  const where = { userId };
  if (filters.category) where.category = filters.category;
  if (filters.status) where.status = filters.status;
  if (filters.platform) where.platform = filters.platform;
  if (filters.mood) where.mood = filters.mood;
  if (filters.duration) where.durationBucket = filters.duration;
  if (filters.priority) where.priority = filters.priority;
  if (filters.hasCapsule === true) where.capsule = { isNot: null };
  if (filters.hasCapsule === false) where.capsule = { is: null };
  return where;
}

function buildReasons(item, query, scores) {
  const reasons = [];
  const text = normalize(query);
  const concepts = asArray(item.capsule?.concepts).map(String);
  const matchedConcepts = concepts.filter((concept) => tokenize(text).some((token) => normalize(concept).includes(token))).slice(0, 3);
  if (matchedConcepts.length) reasons.push(`Possui os conceitos ${matchedConcepts.join(", ")}.`);
  if (scores.semanticAvailable && scores.semanticScore >= 0.62) reasons.push("Relacionado semanticamente à intenção da busca.");
  if (/rapido|curto|almoco|pouco tempo/.test(text) && item.durationBucket === "short") reasons.push("Conteúdo curto para uma janela pequena de tempo.");
  if (/cansado|leve|sem foco/.test(text) && ["leve", "neutro"].includes(item.mood)) reasons.push("Compatível com baixo esforço mental.");
  if (item.priority === "alta" || item.status === "importante") reasons.push("Marcado por você como importante.");
  if (!reasons.length && scores.textualScore > 0.2) reasons.push("Os termos aparecem no título, nas tags ou nas suas notas.");
  if (!reasons.length && item.capsule?.summary) reasons.push("A cápsula deste item se aproxima da consulta.");
  return reasons.slice(0, 3);
}

function buildHighlights(item, query) {
  const tokens = tokenize(query);
  const fields = [
    ["title", item.titleCustom || item.titleAi || item.titleOriginal],
    ["note", item.note],
    ["summary", item.summary || item.capsule?.summary],
    ["concepts", asArray(item.capsule?.concepts).join(", ")],
    ["tags", (item.tags || []).join(", ")],
  ];
  return fields
    .filter(([, value]) => value && (!tokens.length || tokens.some((token) => normalize(value).includes(token))))
    .slice(0, 3)
    .map(([field, value]) => ({ field, text: String(value).replace(/\s+/g, " ").trim().slice(0, 220) }));
}

function serializeSearchResult(entry) {
  const { embedding, userId, sourceText, ...item } = entry.item;
  return {
    item: {
      ...item,
      createdAt: item.createdAt?.toISOString?.() || item.createdAt,
      updatedAt: item.updatedAt?.toISOString?.() || item.updatedAt,
      capsule: item.capsule ? {
        ...item.capsule,
        generatedAt: item.capsule.generatedAt?.toISOString?.() || item.capsule.generatedAt,
      } : null,
    },
    score: round(entry.finalScore),
    textualScore: round(entry.textualScore),
    semanticScore: round(entry.semanticScore),
    reasons: entry.reasons,
    highlights: entry.highlights,
    indexingStatus: embedding?.status || "pending",
  };
}

function parseBoolean(value) {
  if (value === undefined || value === null || value === "") return null;
  if ([true, "true", "1"].includes(value)) return true;
  if ([false, "false", "0"].includes(value)) return false;
  return null;
}

function cleanString(value, max) {
  if (value === undefined || value === null) return "";
  return String(value).replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanEnum(value, fallback, max) {
  const clean = cleanString(value, max);
  return clean && /^[a-zA-Z0-9_-]+$/.test(clean) ? clean : fallback;
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asVector(value) {
  return Array.isArray(value) ? value.map(Number) : [];
}

function similarityToUnit(value) {
  return clamp01((value + 1) / 2);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function round(value) {
  return Number(clamp01(value).toFixed(4));
}
