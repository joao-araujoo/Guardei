import { createCoalescingTaskQueue } from "../background/coalescingTaskQueue.js";
import { extractCapsuleSource } from "../capsules/contentExtractionService.js";
import { safeLog } from "../security/safeLog.js";

const MAX_SNAPSHOT_TEXT = 120_000;
const snapshotQueue = createCoalescingTaskQueue({
  name: "content-snapshot",
  concurrency: 2,
  maxPending: 5_000,
  onTaskError: (error) => safeLog("warn", "Captura assincrona de snapshot falhou", { code: error?.code || "SNAPSHOT_BACKGROUND_FAILED" }),
});

export async function captureContentSnapshot(prisma, userId, videoId) {
  const video = await prisma.video.findFirst({ where: { id: videoId, userId } });
  if (!video) return null;
  const settings = await prisma.userSettings.findUnique({ where: { userId }, select: { autoSnapshotEnabled: true } });
  if (settings && !settings.autoSnapshotEnabled) return null;

  const source = await extractCapsuleSource({ video });
  const textContent = String(source.sourceText || "").slice(0, MAX_SNAPSHOT_TEXT);
  const snapshot = await prisma.contentSnapshot.upsert({
    where: { videoId },
    create: {
      userId,
      videoId,
      sourceStatus: source.coverage || "metadata_only",
      finalUrl: source.finalUrl || video.canonicalUrl || video.url,
      textContent,
      excerpt: textContent.replace(/\s+/g, " ").slice(0, 1200) || null,
      contentHash: source.sourceTextHash || null,
      capturedAt: new Date(),
    },
    update: {
      sourceStatus: source.coverage || "metadata_only",
      finalUrl: source.finalUrl || video.canonicalUrl || video.url,
      textContent,
      excerpt: textContent.replace(/\s+/g, " ").slice(0, 1200) || null,
      contentHash: source.sourceTextHash || null,
      capturedAt: new Date(),
    },
  });
  return snapshot;
}

export function scheduleContentSnapshot(prisma, userId, videoId) {
  const result = snapshotQueue.enqueue(`${userId}:${videoId}`, () => captureContentSnapshot(prisma, userId, videoId));
  if (!result.accepted) safeLog("warn", "Fila de snapshots cheia; captura automatica foi adiada", { code: "BACKGROUND_QUEUE_FULL" });
  return result;
}

export function getSnapshotQueueStats() {
  return snapshotQueue.getStats();
}
