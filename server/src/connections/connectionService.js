import { composeEmbeddingText } from "../embeddings/embeddingText.js";
import { createLocalEmbedding, cosineSimilarity } from "../embeddings/localEmbedding.js";

const MAX_RELATED = 12;
const MAX_MAP_ITEMS = 80;

export async function findRelatedItems({ prisma, userId, videoId, limit = 6 }) {
  const safeLimit = Math.max(1, Math.min(MAX_RELATED, Number(limit) || 6));
  const source = await prisma.video.findFirst({
    where: { id: videoId, userId },
    include: { capsule: { select: { summary: true, concepts: true, keyPoints: true } }, embedding: true, learningPathItems: { select: { learningPathId: true } } },
  });
  if (!source) return { notFound: true, items: [] };

  const candidates = await prisma.video.findMany({
    where: { userId, id: { not: videoId }, status: { not: "arquivado" } },
    orderBy: { updatedAt: "desc" },
    take: 160,
    include: { capsule: { select: { summary: true, concepts: true, keyPoints: true } }, embedding: true, learningPathItems: { select: { learningPathId: true } } },
  });
  const sourceVector = getVector(source);
  const sourceConcepts = normalizeSet(source.capsule?.concepts);
  const sourcePathIds = new Set((source.learningPathItems || []).map((item) => item.learningPathId));

  const ranked = candidates.map((candidate) => {
    const semanticScore = toUnit(cosineSimilarity(sourceVector, getVector(candidate)));
    const sharedConcepts = [...normalizeSet(candidate.capsule?.concepts)].filter((concept) => sourceConcepts.has(concept));
    const sharedTags = (candidate.tags || []).filter((tag) => (source.tags || []).map(normalize).includes(normalize(tag))).slice(0, 3);
    const sharedPaths = (candidate.learningPathItems || []).filter((item) => sourcePathIds.has(item.learningPathId)).map((item) => item.learningPathId);
    const conceptScore = Math.min(1, sharedConcepts.length * 0.22 + sharedTags.length * 0.12 + (sharedPaths.length ? 0.24 : 0));
    const score = semanticScore * 0.68 + conceptScore * 0.32;
    return { candidate, score, semanticScore, sharedConcepts: sharedConcepts.slice(0, 3), sharedTags, sharedPaths, source };
  })
    .filter((entry) => entry.score >= 0.38)
    .sort((a, b) => b.score - a.score)
    .slice(0, safeLimit)
    .map(serializeRelated);

  return { notFound: false, items: ranked };
}

export async function buildKnowledgeMap({ prisma, userId, filters = {} }) {
  const take = Math.max(10, Math.min(MAX_MAP_ITEMS, Number(filters.limit) || 50));
  const where = { userId };
  if (filters.category) where.category = filters.category;
  if (filters.status) where.status = filters.status;
  if (filters.pathId) where.learningPathItems = { some: { learningPathId: filters.pathId, learningPath: { is: { userId } } } };

  const videos = await prisma.video.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take,
    include: { capsule: { select: { concepts: true, summary: true } }, embedding: true, learningPathItems: { select: { learningPathId: true } } },
  });
  const nodes = videos.map((video) => ({
    id: video.id,
    type: "content",
    label: video.titleCustom || video.titleAi || video.titleOriginal || "Sem titulo",
    category: video.category,
    status: video.status,
    concepts: [...normalizeSet(video.capsule?.concepts)].slice(0, 5),
    pathIds: video.learningPathItems.map((item) => item.learningPathId),
  }));
  const edges = [];
  for (let left = 0; left < videos.length; left += 1) {
    const leftVector = getVector(videos[left]);
    for (let right = left + 1; right < videos.length; right += 1) {
      const similarity = toUnit(cosineSimilarity(leftVector, getVector(videos[right])));
      const shared = [...normalizeSet(videos[left].capsule?.concepts)].filter((concept) => normalizeSet(videos[right].capsule?.concepts).has(concept));
      const weight = similarity * 0.8 + Math.min(0.2, shared.length * 0.08);
      if (weight >= 0.64) {
        edges.push({
          id: `${videos[left].id}:${videos[right].id}`,
          source: videos[left].id,
          target: videos[right].id,
          weight: Number(weight.toFixed(4)),
          reason: shared.length ? `Conceitos compartilhados: ${shared.slice(0, 2).join(", ")}` : "Proximidade semantica reproduzivel",
        });
      }
    }
  }
  return { nodes, edges: edges.sort((a, b) => b.weight - a.weight).slice(0, 160), total: nodes.length, truncated: videos.length === take };
}

function getVector(video) {
  const stored = Array.isArray(video.embedding?.vector) && video.embedding.status === "indexed" ? video.embedding.vector.map(Number) : null;
  return stored?.length ? stored : createLocalEmbedding(composeEmbeddingText(video));
}

function serializeRelated(entry) {
  const item = entry.candidate;
  return {
    item: {
      id: item.id,
      titleCustom: item.titleCustom,
      titleAi: item.titleAi,
      titleOriginal: item.titleOriginal,
      thumbnailUrl: item.thumbnailUrl,
      category: item.category,
      platform: item.platform,
      status: item.status,
      priority: item.priority,
      tags: item.tags,
      durationBucket: item.durationBucket,
      mood: item.mood,
    },
    score: Number(entry.score.toFixed(4)),
    reason: relationReason(entry),
    sharedConcepts: entry.sharedConcepts,
  };
}

function relationReason(entry) {
  if (entry.sharedPaths?.length) return "Relacionado ao mesmo objetivo em uma trilha.";
  if (entry.sharedConcepts.length >= 2) return `Mesmo conceito: ${entry.sharedConcepts.slice(0, 2).join(" e ")}.`;
  if (entry.sharedConcepts.length === 1) return `Complementar em ${entry.sharedConcepts[0]}.`;
  if (["leve", "baixo"].includes(entry.candidate.effort) && ["alto", "focado"].includes(entry.source?.effort)) return "Conteudo mais introdutorio ou leve sobre o assunto.";
  if (["alto", "focado"].includes(entry.candidate.effort) && ["leve", "baixo"].includes(entry.source?.effort)) return "Conteudo mais avancado para aprofundar o assunto.";
  if (entry.semanticScore > 0.78) return "Proximo passo ou visao complementar do mesmo assunto.";
  if (entry.sharedTags.length) return `Relacionado pelas tags ${entry.sharedTags.join(", ")}.`;
  return "Relacionado semanticamente ao conteudo atual.";
}

function normalizeSet(value) {
  return new Set((Array.isArray(value) ? value : []).map(normalize).filter(Boolean));
}
function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
function toUnit(value) {
  return Math.max(0, Math.min(1, (Number(value) + 1) / 2));
}
