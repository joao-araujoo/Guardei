import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../db/prisma.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const items = await prisma.video.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });
    res.json(items.map(fromDbVideo));
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const video = req.body || {};
    if (!video.url) return res.status(400).json({ ok: false, message: "URL obrigatoria." });

    const existing = await prisma.video.findFirst({
      where: {
        userId: req.user.id,
        OR: [{ url: video.url }, { canonicalUrl: video.canonicalUrl || video.url }],
      },
    });
    if (existing) return res.json({ video: fromDbVideo(existing), duplicated: true });

    const created = await prisma.video.create({ data: toDbVideo(video, req.user.id) });
    res.status(201).json({ video: fromDbVideo(created), duplicated: false });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const result = await prisma.video.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: toDbVideoPatch(req.body || {}),
    });
    if (!result.count) return res.status(404).json({ ok: false, message: "Video nao encontrado." });

    const updated = await prisma.video.findUnique({ where: { id: req.params.id } });
    res.json(fromDbVideo(updated));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const result = await prisma.video.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
    if (!result.count) return res.status(404).json({ ok: false, message: "Video nao encontrado." });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post("/import", async (req, res, next) => {
  try {
    const videos = Array.isArray(req.body?.videos) ? req.body.videos : [];
    for (const video of videos) {
      if (!video.url) continue;
      const existing = await prisma.video.findFirst({ where: { userId: req.user.id, url: video.url } });
      if (existing) {
        await prisma.video.update({
          where: { id: existing.id },
          data: toDbVideoPatch(video),
        });
      } else {
        await prisma.video.create({ data: toDbVideo(video, req.user.id) });
      }
    }
    const all = await prisma.video.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });
    res.json(all.map(fromDbVideo));
  } catch (error) {
    next(error);
  }
});

function toDbVideo(video, userId) {
  return {
    id: video.id,
    userId,
    url: video.url,
    canonicalUrl: video.canonicalUrl || video.url,
    platform: video.platform || "web",
    platformLabel: video.platformLabel,
    videoId: video.videoId,
    tiktokId: video.tiktokId,
    titleOriginal: video.titleOriginal,
    titleAi: video.titleAi || "Link salvo para revisar",
    titleCustom: video.titleCustom,
    authorName: video.authorName,
    authorUrl: video.authorUrl,
    thumbnailUrl: video.thumbnailUrl,
    thumbnailFallback: video.thumbnailFallback,
    providerName: video.providerName,
    description: video.description,
    category: video.category || "misc",
    reason: video.reason || "guardar",
    tags: Array.isArray(video.tags) ? video.tags : [],
    priority: normalizePriority(video.priority),
    status: normalizeStatus(video.status),
    note: video.note,
    summary: video.summary,
    mood: video.mood,
    effort: video.effort,
    durationBucket: video.durationBucket,
    bestFor: video.bestFor,
    watchWhen: video.watchWhen,
    sourceText: video.sourceText,
    origin: video.origin || "manual",
    reviewCount: Number(video.reviewCount || 0),
    schemaVersion: Number(video.schemaVersion || 3),
    aiEngine: video.ai?.engine,
    aiConfidence: Number.isFinite(video.ai?.confidence) ? video.ai.confidence : null,
    aiRationale: video.ai?.rationale,
    reviewedAt: video.reviewedAt ? new Date(video.reviewedAt) : null,
    createdAt: video.createdAt ? new Date(video.createdAt) : undefined,
    updatedAt: video.updatedAt ? new Date(video.updatedAt) : undefined,
  };
}

function toDbVideoPatch(patch) {
  const data = {};
  const directFields = [
    "canonicalUrl", "platform", "platformLabel", "videoId", "tiktokId", "titleOriginal",
    "titleAi", "titleCustom", "authorName", "authorUrl", "thumbnailUrl", "thumbnailFallback",
    "providerName", "description", "category", "reason", "tags", "note", "summary", "mood",
    "effort", "durationBucket", "bestFor", "watchWhen", "sourceText", "origin", "reviewCount",
    "schemaVersion",
  ];

  for (const field of directFields) {
    if (patch[field] !== undefined) data[field] = patch[field];
  }

  if (patch.priority !== undefined) data.priority = normalizePriority(patch.priority);
  if (patch.status !== undefined) data.status = normalizeStatus(patch.status);
  if (patch.reviewedAt !== undefined) data.reviewedAt = patch.reviewedAt ? new Date(patch.reviewedAt) : null;
  if (patch.ai?.engine !== undefined) data.aiEngine = patch.ai.engine;
  if (patch.ai?.confidence !== undefined) data.aiConfidence = patch.ai.confidence;
  if (patch.ai?.rationale !== undefined) data.aiRationale = patch.ai.rationale;

  return data;
}

function fromDbVideo(video) {
  const { userId, ...publicVideo } = video;
  return {
    ...publicVideo,
    createdAt: video.createdAt?.toISOString?.() || video.createdAt,
    updatedAt: video.updatedAt?.toISOString?.() || video.updatedAt,
    reviewedAt: video.reviewedAt?.toISOString?.() || video.reviewedAt,
    ai: {
      engine: video.aiEngine,
      confidence: video.aiConfidence,
      rationale: video.aiRationale,
    },
  };
}

function normalizePriority(value) {
  return ["baixa", "media", "alta"].includes(value) ? value : "baixa";
}

function normalizeStatus(value) {
  return ["inbox", "novo", "rever", "importante", "aplicado", "arquivado"].includes(value) ? value : "novo";
}

export default router;
