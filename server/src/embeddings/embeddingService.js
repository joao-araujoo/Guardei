import { composeEmbeddingText, hashEmbeddingContent } from "./embeddingText.js";
import { generateEmbedding } from "./embeddingProvider.js";
import { cosineSimilarity } from "./localEmbedding.js";
import { safeLog } from "../security/safeLog.js";

export async function ensureVideoEmbedding({ prisma, userId, videoId, generator = generateEmbedding, force = false }) {
  const video = await prisma.video.findFirst({
    where: { id: videoId, userId },
    include: { capsule: { select: { summary: true, concepts: true, keyPoints: true } }, embedding: true },
  });
  if (!video) return { notFound: true };
  const text = composeEmbeddingText(video);
  const contentHash = hashEmbeddingContent(text);
  const current = video.embedding;
  if (!force && current?.status === "indexed" && current.contentHash === contentHash) return { embedding: current, reused: true };

  await prisma.videoEmbedding.upsert({
    where: { videoId },
    create: { userId, videoId, vector: [], contentHash, status: "pending" },
    update: { contentHash, status: current ? "outdated" : "pending", errorCode: null, errorMessage: null },
  });

  try {
    const generated = await generator(text, { allowFallback: true });
    const embedding = await prisma.videoEmbedding.update({
      where: { videoId },
      data: {
        provider: generated.provider,
        model: generated.model,
        dimensions: generated.dimensions,
        vector: generated.vector,
        contentHash,
        status: "indexed",
        indexedAt: new Date(),
        errorCode: null,
        errorMessage: null,
      },
    });
    return { embedding, reused: false };
  } catch (error) {
    safeLog("warn", "Falha ao indexar item", { userId, videoId, code: error?.code });
    const embedding = await prisma.videoEmbedding.update({
      where: { videoId },
      data: { status: "failed", errorCode: normalizeCode(error), errorMessage: "Indexacao indisponivel; a busca textual continua funcionando." },
    });
    return { embedding, failed: true };
  }
}

export async function markEmbeddingOutdated(prisma, userId, videoId) {
  const owned = await prisma.video.findFirst({ where: { id: videoId, userId }, select: { id: true } });
  if (!owned) return false;
  await prisma.videoEmbedding.upsert({
    where: { videoId },
    create: { userId, videoId, vector: [], contentHash: "", status: "pending" },
    update: { status: "outdated", errorCode: null, errorMessage: null },
  });
  return true;
}

export function scheduleEmbeddingRefresh(prisma, userId, videoId) {
  queueMicrotask(() => {
    ensureVideoEmbedding({ prisma, userId, videoId }).catch((error) => safeLog("warn", "Indexacao assincrona falhou", { userId, videoId, code: error?.code }));
  });
}

export async function deleteEmbedding(prisma, userId, videoId) {
  const result = await prisma.videoEmbedding.deleteMany({ where: { userId, videoId } });
  return result.count > 0;
}

export async function createQueryEmbedding(query, generator = generateEmbedding) {
  const generated = await generator(String(query || "").slice(0, 1_200), { allowFallback: true });
  return generated.vector;
}

export function calculateSimilarity(vectorA, vectorB) {
  return cosineSimilarity(asVector(vectorA), asVector(vectorB));
}

function asVector(value) {
  return Array.isArray(value) ? value.map(Number) : [];
}

function normalizeCode(error) {
  const code = String(error?.code || "EMBEDDING_FAILED").toUpperCase();
  return /^[A-Z0-9_]{3,64}$/.test(code) ? code : "EMBEDDING_FAILED";
}
