import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../db/prisma.js";
import { validateApplicationPayload } from "../reviews/reviewSchema.js";
import { serializeApplication } from "../reviews/reviewService.js";

const router = express.Router();
router.use(requireAuth);

router.get("/applications", async (req, res, next) => {
  try {
    const limit = clampInt(req.query.limit, 1, 100, 30);
    const offset = clampInt(req.query.offset, 0, 10_000, 0);
    const status = req.query.status ? readEnum(req.query.status, ["planned", "in_progress", "completed", "dismissed"], "status") : undefined;
    const videoId = req.query.videoId ? String(req.query.videoId).slice(0, 120) : undefined;
    const learningPathId = req.query.learningPathId ? String(req.query.learningPathId).slice(0, 120) : undefined;
    const where = { userId: req.user.id, ...(status ? { status } : {}), ...(videoId ? { videoId } : {}), ...(learningPathId ? { learningPathId } : {}) };
    const [items, total] = await Promise.all([
      prisma.applicationCommitment.findMany({ where, orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }], skip: offset, take: limit, include: includes }),
      prisma.applicationCommitment.count({ where }),
    ]);
    return res.json({ applications: items.map(serializeApplication), total, limit, offset });
  } catch (error) { return next(error); }
});

router.post("/videos/:id/applications", async (req, res, next) => {
  try {
    const payload = validateApplicationPayload(req.body || {});
    const video = await prisma.video.findFirst({ where: { id: req.params.id, userId: req.user.id }, select: { id: true, status: true, applicationStatus: true } });
    if (!video) return res.status(404).json({ ok: false, code: "VIDEO_NOT_FOUND", message: "Conteudo nao encontrado." });
    if (payload.learningPathId) {
      const path = await prisma.learningPath.findFirst({ where: { id: payload.learningPathId, userId: req.user.id }, select: { id: true } });
      if (!path) return res.status(404).json({ ok: false, code: "PATH_NOT_FOUND", message: "Trilha nao encontrada." });
    }
    const now = new Date();
    const execute = async (tx) => {
      const item = await tx.applicationCommitment.create({
        data: {
          userId: req.user.id,
          videoId: video.id,
          ...payload,
          status: payload.status || "planned",
          completedAt: payload.status === "completed" ? now : null,
        },
        include: includes,
      });
      await applyVideoState(tx, video, item, now);
      return item;
    };
    const item = typeof prisma.$transaction === "function" ? await prisma.$transaction(execute) : await execute(prisma);
    return res.status(201).json({ application: serializeApplication(item) });
  } catch (error) { return next(error); }
});

router.patch("/applications/:id", async (req, res, next) => {
  try {
    const payload = validateApplicationPayload(req.body || {}, { partial: true });
    const existing = await prisma.applicationCommitment.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { video: { select: { id: true, status: true, applicationStatus: true } } },
    });
    if (!existing) return res.status(404).json({ ok: false, code: "APPLICATION_NOT_FOUND", message: "Compromisso nao encontrado." });
    if (payload.learningPathId) {
      const path = await prisma.learningPath.findFirst({ where: { id: payload.learningPathId, userId: req.user.id }, select: { id: true } });
      if (!path) return res.status(404).json({ ok: false, code: "PATH_NOT_FOUND", message: "Trilha nao encontrada." });
    }
    const now = new Date();
    const nextStatus = payload.status || existing.status;
    if (nextStatus === "completed" && !payload.evidenceText && !payload.evidenceUrl && !payload.reflection && !existing.evidenceText && !existing.evidenceUrl && !existing.reflection) {
      return res.status(400).json({ ok: false, code: "APPLICATION_EVIDENCE_REQUIRED", message: "Ao concluir, registre uma evidencia ou reflexao curta sobre o que foi aplicado." });
    }
    const execute = async (tx) => {
      const item = await tx.applicationCommitment.update({
        where: { id: existing.id },
        data: { ...payload, completedAt: nextStatus === "completed" ? existing.completedAt || now : nextStatus === "dismissed" ? null : existing.completedAt },
        include: includes,
      });
      if (item.status === "completed") await applyVideoState(tx, existing.video, item, now);
      else await recomputeVideoApplicationState(tx, req.user.id, existing.video, item.videoId, now);
      if (item.status === "completed" && item.reviewAgain) {
        await tx.knowledgeCard.updateMany({ where: { userId: req.user.id, videoId: item.videoId, status: "active" }, data: { nextReviewAt: now } });
      }
      return item;
    };
    const item = typeof prisma.$transaction === "function" ? await prisma.$transaction(execute) : await execute(prisma);
    return res.json({ application: serializeApplication(item) });
  } catch (error) { return next(error); }
});

router.delete("/applications/:id", async (req, res, next) => {
  try {
    const existing = await prisma.applicationCommitment.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { video: { select: { id: true, status: true, applicationStatus: true } } },
    });
    if (!existing) return res.status(404).json({ ok: false, code: "APPLICATION_NOT_FOUND", message: "Compromisso nao encontrado." });
    const execute = async (tx) => {
      await tx.applicationCommitment.delete({ where: { id: existing.id } });
      await recomputeVideoApplicationState(tx, req.user.id, existing.video, existing.videoId, new Date());
    };
    if (typeof prisma.$transaction === "function") await prisma.$transaction(execute);
    else await execute(prisma);
    return res.status(204).end();
  } catch (error) { return next(error); }
});

export async function applyVideoState(tx, video, item, now) {
  if (item.status === "completed") {
    await tx.video.update({
      where: { id: video.id },
      data: {
        status: "aplicado",
        applicationStatus: "completed",
        appliedAt: item.completedAt || now,
        applicationNote: item.reflection || item.evidenceText || item.description,
        applicationEvidenceUrl: item.evidenceUrl,
      },
    });
    return;
  }
  if (video.applicationStatus === "completed" || video.applicationStatus === "legacy_applied") return;
  await tx.video.update({ where: { id: video.id }, data: { applicationStatus: item.status === "in_progress" ? "in_progress" : item.status === "planned" ? "planned" : "none" } });
}

export async function recomputeVideoApplicationState(tx, userId, video, videoId, now = new Date()) {
  const commitments = await tx.applicationCommitment.findMany({
    where: { userId, videoId },
    orderBy: [{ completedAt: "desc" }, { updatedAt: "desc" }],
    select: { status: true, completedAt: true, reflection: true, evidenceText: true, evidenceUrl: true, description: true },
  });
  const completed = commitments.find((item) => item.status === "completed");
  if (completed) return applyVideoState(tx, video, completed, now);
  if (video.applicationStatus === "legacy_applied") return;
  const applicationStatus = commitments.some((item) => item.status === "in_progress")
    ? "in_progress"
    : commitments.some((item) => item.status === "planned") ? "planned" : "none";
  await tx.video.update({
    where: { id: videoId },
    data: {
      applicationStatus,
      appliedAt: null,
      applicationNote: null,
      applicationEvidenceUrl: null,
      ...(video.status === "aplicado" ? { status: "rever" } : {}),
    },
  });
}

const includes = {
  video: { select: { id: true, titleCustom: true, titleAi: true, titleOriginal: true, url: true, category: true, thumbnailUrl: true, platform: true } },
  learningPath: { select: { id: true, title: true } },
};
function clampInt(value, min, max, fallback) { if (value === undefined) return fallback; const n = Number(value); if (!Number.isInteger(n) || n < min || n > max) throw bad("PAGINATION_INVALID", "Paginacao invalida."); return n; }
function readEnum(value, allowed, field) { if (typeof value !== "string" || !allowed.includes(value)) throw bad("FILTER_INVALID", `${field} invalido.`); return value; }
function bad(code, message) { const error = new Error(message); error.code = code; error.status = 400; return error; }
export default router;
