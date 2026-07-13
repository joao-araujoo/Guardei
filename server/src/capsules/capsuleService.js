import { extractCapsuleSource } from "./contentExtractionService.js";
import { serializeCapsule } from "./capsuleSchema.js";
import { safeLog } from "../security/safeLog.js";

export async function findOwnedVideo(prisma, userId, videoId) {
  return prisma.video.findFirst({ where: { id: videoId, userId } });
}

export async function getCapsuleForUser(prisma, userId, videoId) {
  const video = await findOwnedVideo(prisma, userId, videoId);
  if (!video) return { notFound: true, capsule: null };
  const capsule = await prisma.contentCapsule.findFirst({ where: { videoId, userId } });
  return { notFound: false, capsule: serializeCapsule(capsule) };
}

export async function createOrRegenerateCapsule({ prisma, userId, videoId, input, force = false, extractor = extractCapsuleSource, generator = null }) {
  const video = await findOwnedVideo(prisma, userId, videoId);
  if (!video) return { notFound: true };

  const existing = await prisma.contentCapsule.findFirst({ where: { videoId, userId } });
  if (existing && !force && !input.forceRegenerate && ["completed", "limited"].includes(existing.status)) {
    return { capsule: serializeCapsule(existing), reused: true };
  }

  const baseData = { userId, videoId, status: "extracting", errorCode: null, errorMessage: null };
  await prisma.contentCapsule.upsert({
    where: { videoId },
    create: baseData,
    update: { status: "extracting", errorCode: null, errorMessage: null },
  });

  try {
    const source = await extractor({ video, sourceText: input.sourceText, analysisMode: input.analysisMode });
    await prisma.contentCapsule.update({
      where: { videoId },
      data: {
        status: "generating",
        coverage: source.coverage,
        sourceText: source.sourceText,
        sourceTextHash: source.sourceTextHash,
      },
    });

    const generatorFn = generator || (await import("./capsuleGenerator.js")).generateCapsule;
    const generated = await generatorFn({ video, source });
    const saved = await prisma.contentCapsule.update({
      where: { videoId },
      data: {
        ...generated,
        sourceText: source.sourceText,
        sourceTextHash: source.sourceTextHash,
        errorCode: source.extractionErrorCode,
        errorMessage: source.extractionErrorCode ? "O conteudo remoto nao estava disponivel; foram usados os dados permitidos." : null,
        generatedAt: new Date(),
      },
    });
    return { capsule: serializeCapsule(saved), reused: false };
  } catch (error) {
    safeLog("error", "Falha ao gerar capsula", { code: error?.code, name: error?.name, videoId, userId });
    const failed = await prisma.contentCapsule.update({
      where: { videoId },
      data: {
        status: "failed",
        errorCode: normalizeErrorCode(error),
        errorMessage: "Nao foi possivel concluir a analise. Tente novamente ou forneca um texto manualmente.",
      },
    });
    return { capsule: serializeCapsule(failed), failed: true };
  }
}

export async function deleteCapsuleForUser(prisma, userId, videoId) {
  const video = await findOwnedVideo(prisma, userId, videoId);
  if (!video) return false;
  const result = await prisma.contentCapsule.deleteMany({ where: { videoId, userId } });
  return result.count > 0;
}

function normalizeErrorCode(error) {
  const code = String(error?.code || "GENERATION_FAILED").toUpperCase();
  return /^[A-Z0-9_]{3,64}$/.test(code) ? code : "GENERATION_FAILED";
}
