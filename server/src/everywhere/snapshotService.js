import { extractCapsuleSource } from "../capsules/contentExtractionService.js";

const MAX_SNAPSHOT_TEXT = 120_000;

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
  const timer = setTimeout(() => captureContentSnapshot(prisma, userId, videoId).catch(() => {}), 350);
  timer.unref?.();
  return timer;
}
