import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { prisma } from "../db/prisma.js";
import { generateCardSuggestions } from "../cards/cardGenerator.js";
import { clampGeneratedCardLimit, validateCardPayload, validateReviewPayload } from "../reviews/reviewSchema.js";
import { recordReviewAttempt, serializeCard } from "../reviews/reviewService.js";

const router = express.Router();
const generationLimit = createRateLimiter({ windowMs: 10 * 60 * 1000, limit: 10, keyPrefix: "card-generation" });
router.use(requireAuth);

router.get("/cards", async (req, res, next) => {
  try {
    const limit = clampInt(req.query.limit, 1, 100, 30);
    const offset = clampInt(req.query.offset, 0, 10_000, 0);
    const status = req.query.status === undefined ? undefined : readEnum(req.query.status, ["active", "suspended"], "status");
    const due = readBoolean(req.query.due, "due");
    const videoId = req.query.videoId ? String(req.query.videoId).slice(0, 120) : undefined;
    const where = { userId: req.user.id, ...(status ? { status } : {}), ...(videoId ? { videoId } : {}) };
    if (due === true) Object.assign(where, { status: "active", nextReviewAt: { lte: new Date() } });
    const [cards, total] = await Promise.all([
      prisma.knowledgeCard.findMany({ where, orderBy: [{ nextReviewAt: "asc" }, { createdAt: "asc" }], skip: offset, take: limit, include: { video: { select: videoSelect } } }),
      prisma.knowledgeCard.count({ where }),
    ]);
    return res.json({ cards: cards.map(serializeCard), total, limit, offset });
  } catch (error) { return next(error); }
});

router.post("/cards", async (req, res, next) => {
  try {
    const payload = validateCardPayload(req.body || {});
    const video = await prisma.video.findFirst({ where: { id: payload.videoId, userId: req.user.id }, select: { id: true } });
    if (!video) return res.status(404).json({ ok: false, code: "VIDEO_NOT_FOUND", message: "Conteudo nao encontrado." });
    const card = await prisma.knowledgeCard.create({
      data: {
        userId: req.user.id,
        videoId: payload.videoId,
        question: payload.question,
        answer: payload.answer,
        hint: payload.hint,
        cardType: payload.cardType || "question_answer",
        sourceType: payload.sourceType || "manual",
        status: payload.status || "active",
        nextReviewAt: payload.nextReviewAt || new Date(),
      },
      include: { video: { select: videoSelect } },
    });
    return res.status(201).json({ card: serializeCard(card) });
  } catch (error) { return next(error); }
});

router.patch("/cards/:id", async (req, res, next) => {
  try {
    const payload = validateCardPayload(req.body || {}, { partial: true });
    delete payload.videoId;
    delete payload.sourceType;
    const owned = await prisma.knowledgeCard.findFirst({ where: { id: req.params.id, userId: req.user.id }, select: { id: true } });
    if (!owned) return res.status(404).json({ ok: false, code: "CARD_NOT_FOUND", message: "Cartao nao encontrado." });
    const card = await prisma.knowledgeCard.update({ where: { id: owned.id }, data: payload, include: { video: { select: videoSelect } } });
    return res.json({ card: serializeCard(card) });
  } catch (error) { return next(error); }
});

router.delete("/cards/:id", async (req, res, next) => {
  try {
    const result = await prisma.knowledgeCard.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
    if (!result.count) return res.status(404).json({ ok: false, code: "CARD_NOT_FOUND", message: "Cartao nao encontrado." });
    return res.status(204).end();
  } catch (error) { return next(error); }
});

router.post("/cards/:id/review", async (req, res, next) => {
  try {
    const payload = validateReviewPayload(req.body || {});
    const result = await recordReviewAttempt({ prisma, userId: req.user.id, cardId: req.params.id, payload });
    if (result.notFound) return res.status(404).json({ ok: false, code: "CARD_NOT_FOUND", message: "Cartao nao encontrado." });
    if (result.conflict) return res.status(409).json({ ok: false, code: result.code, message: result.message });
    return res.status(201).json(result);
  } catch (error) { return next(error); }
});

router.post("/videos/:id/cards/generate", generationLimit, async (req, res, next) => {
  try {
    const maxCards = clampGeneratedCardLimit(req.body?.limit);
    const video = await prisma.video.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        capsule: { select: { summary: true, keyPoints: true, concepts: true, reflectionQuestions: true, coverage: true } },
        reflection: true,
      },
    });
    if (!video) return res.status(404).json({ ok: false, code: "VIDEO_NOT_FOUND", message: "Conteudo nao encontrado." });
    const suggestions = await generateCardSuggestions({ video, reflection: video.reflection, maxCards });
    return res.json({ suggestions, limit: maxCards, persisted: false, source: process.env.GEMINI_API_KEY ? "gemini-or-fallback" : "local-fallback" });
  } catch (error) { return next(error); }
});

const videoSelect = { id: true, titleCustom: true, titleAi: true, titleOriginal: true, url: true, category: true, thumbnailUrl: true, platform: true };
function clampInt(value, min, max, fallback) { if (value === undefined) return fallback; const n = Number(value); if (!Number.isInteger(n) || n < min || n > max) throw bad("PAGINATION_INVALID", "Paginacao invalida."); return n; }
function readEnum(value, allowed, field) { if (typeof value !== "string" || !allowed.includes(value)) throw bad("FILTER_INVALID", `${field} invalido.`); return value; }
function readBoolean(value, field) { if (value === undefined) return undefined; if (value === "true" || value === true) return true; if (value === "false" || value === false) return false; throw bad("FILTER_INVALID", `${field} deve ser true ou false.`); }
function bad(code, message) { const error = new Error(message); error.code = code; error.status = 400; return error; }
export default router;
