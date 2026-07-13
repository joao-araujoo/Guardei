import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../db/prisma.js";
import { scheduleEmbeddingRefresh, markEmbeddingOutdated } from "../embeddings/embeddingService.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const items = await prisma.video.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      include: capsuleSummaryInclude,
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
    scheduleEmbeddingRefresh(prisma, req.user.id, created.id);
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

    const updated = await prisma.video.findUnique({ where: { id: req.params.id }, include: capsuleSummaryInclude });
    if (embeddingRelevantPatch(req.body || {})) {
      await markEmbeddingOutdated(prisma, req.user.id, req.params.id);
      scheduleEmbeddingRefresh(prisma, req.user.id, req.params.id);
    }
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
        scheduleEmbeddingRefresh(prisma, req.user.id, existing.id);
      } else {
        const created = await prisma.video.create({ data: toDbVideo(video, req.user.id) });
        scheduleEmbeddingRefresh(prisma, req.user.id, created.id);
      }
    }
    const all = await prisma.video.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      include: capsuleSummaryInclude,
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
    sourceName: video.sourceName,
    watchedAt: video.watchedAt ? new Date(video.watchedAt) : null,
    consumedAt: (video.consumedAt || video.watchedAt) ? new Date(video.consumedAt || video.watchedAt) : null,
    appliedAt: video.appliedAt ? new Date(video.appliedAt) : null,
    applicationStatus: normalizeApplicationStatus(video.applicationStatus, video.status),
    applicationNote: cleanOptional(video.applicationNote, 2_000),
    applicationEvidenceUrl: cleanOptional(video.applicationEvidenceUrl, 2_000),
    watchedSeconds: Number(video.watchedSeconds || 0),
    watchCount: Number(video.watchCount || 0),
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

export function toDbVideoPatch(patch) {
  const data = {};
  const directFields = [
    "canonicalUrl", "platform", "platformLabel", "videoId", "tiktokId", "titleOriginal",
    "titleAi", "titleCustom", "authorName", "authorUrl", "thumbnailUrl", "thumbnailFallback",
    "providerName", "description", "category", "reason", "tags", "note", "summary", "mood",
    "effort", "durationBucket", "bestFor", "watchWhen", "sourceName", "sourceText", "origin", "reviewCount",
    "schemaVersion", "applicationNote", "applicationEvidenceUrl",
  ];

  for (const field of directFields) {
    if (patch[field] !== undefined) data[field] = patch[field];
  }

  if (patch.priority !== undefined) data.priority = normalizePriority(patch.priority);
  if (patch.status !== undefined) {
    data.status = normalizeStatus(patch.status);
    if (data.status === "aplicado" && patch.applicationStatus === undefined) data.applicationStatus = "legacy_applied";
  }
  if (patch.reviewedAt !== undefined) data.reviewedAt = patch.reviewedAt ? new Date(patch.reviewedAt) : null;
  if (patch.watchedAt !== undefined) {
    data.watchedAt = patch.watchedAt ? new Date(patch.watchedAt) : null;
    if (patch.consumedAt === undefined) data.consumedAt = data.watchedAt;
  }
  if (patch.consumedAt !== undefined) {
    data.consumedAt = patch.consumedAt ? new Date(patch.consumedAt) : null;
    if (patch.watchedAt === undefined) data.watchedAt = data.consumedAt;
  }
  if (patch.appliedAt !== undefined) data.appliedAt = patch.appliedAt ? new Date(patch.appliedAt) : null;
  if (patch.applicationStatus !== undefined) data.applicationStatus = normalizeApplicationStatus(patch.applicationStatus, patch.status);
  if (patch.watchedSeconds !== undefined) data.watchedSeconds = Number(patch.watchedSeconds || 0);
  if (patch.watchCount !== undefined) data.watchCount = Number(patch.watchCount || 0);
  if (patch.ai?.engine !== undefined) data.aiEngine = patch.ai.engine;
  if (patch.ai?.confidence !== undefined) data.aiConfidence = patch.ai.confidence;
  if (patch.ai?.rationale !== undefined) data.aiRationale = patch.ai.rationale;

  return data;
}

const capsuleSummaryInclude = {
  capsule: {
    select: {
      id: true,
      status: true,
      coverage: true,
      summary: true,
      aiConfidence: true,
      generatedAt: true,
      updatedAt: true,
    },
  },
};

export function fromDbVideo(video) {
  const { userId, ...publicVideo } = video;
  return {
    ...publicVideo,
    createdAt: video.createdAt?.toISOString?.() || video.createdAt,
    updatedAt: video.updatedAt?.toISOString?.() || video.updatedAt,
    reviewedAt: video.reviewedAt?.toISOString?.() || video.reviewedAt,
    watchedAt: video.watchedAt?.toISOString?.() || video.watchedAt,
    consumedAt: video.consumedAt?.toISOString?.() || video.consumedAt || video.watchedAt?.toISOString?.() || video.watchedAt,
    appliedAt: video.appliedAt?.toISOString?.() || video.appliedAt,
    capsule: video.capsule ? {
      ...video.capsule,
      generatedAt: video.capsule.generatedAt?.toISOString?.() || video.capsule.generatedAt,
      updatedAt: video.capsule.updatedAt?.toISOString?.() || video.capsule.updatedAt,
    } : null,
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

export function normalizeApplicationStatus(value, status) {
  if (["none", "planned", "in_progress", "completed", "legacy_applied"].includes(value)) return value;
  return status === "aplicado" ? "legacy_applied" : "none";
}

function cleanOptional(value, max) {
  if (value === undefined || value === null || value === "") return null;
  return String(value).replace(/[\u0000-\u001F]/g, "").trim().slice(0, max) || null;
}

function embeddingRelevantPatch(patch) {
  return ["titleCustom", "titleAi", "titleOriginal", "description", "note", "category", "tags", "summary"].some((field) => patch[field] !== undefined);
}

export default router;
