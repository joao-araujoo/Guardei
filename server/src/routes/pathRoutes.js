import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { prisma } from "../db/prisma.js";
import { validatePathPayload } from "../paths/pathSchema.js";
import {
  addPathItem, createPath, duplicatePath, findOwnedPath, generatePath, listPaths, removePathItem,
  reorderPathItems, updateGap, updatePath, updatePathItem,
} from "../paths/pathService.js";

const router = express.Router();
const writeLimiter = createRateLimiter({ windowMs: 10 * 60_000, limit: 60, keyPrefix: "paths-write" });
const generationLimiter = createRateLimiter({ windowMs: 30 * 60_000, limit: 8, keyPrefix: "paths-generate" });
const activeGenerations = new Set();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try { res.json({ ok: true, paths: await listPaths(prisma, req.user.id) }); } catch (error) { next(error); }
});
router.post("/", writeLimiter, conditionalGenerationLimit, async (req, res, next) => {
  try {
    const validation = validatePathPayload(req.body || {});
    if (!validation.ok) return res.status(400).json({ ok: false, code: "INVALID_PATH", message: validation.message });
    const path = await createPath(prisma, req.user.id, validation.value);
    if (path.autoOrganize) {
      const generated = await generatePath({ prisma, userId: req.user.id, pathId: path.id });
      return res.status(201).json({ ok: true, path: generated.path || path, searchMode: generated.searchMode });
    }
    return res.status(201).json({ ok: true, path });
  } catch (error) { next(error); }
});
router.get("/:id", async (req, res, next) => {
  try {
    const path = await findOwnedPath(prisma, req.user.id, req.params.id);
    if (!path) return res.status(404).json({ ok: false, code: "PATH_NOT_FOUND", message: "Trilha nao encontrada." });
    return res.json({ ok: true, path });
  } catch (error) { next(error); }
});
router.patch("/:id", writeLimiter, async (req, res, next) => {
  try {
    const validation = validatePathPayload(req.body || {}, { partial: true });
    if (!validation.ok) return res.status(400).json({ ok: false, code: "INVALID_PATH", message: validation.message });
    const path = await updatePath(prisma, req.user.id, req.params.id, validation.value);
    if (!path) return res.status(404).json({ ok: false, code: "PATH_NOT_FOUND", message: "Trilha nao encontrada." });
    return res.json({ ok: true, path });
  } catch (error) { next(error); }
});
router.delete("/:id", writeLimiter, async (req, res, next) => {
  try {
    const result = await prisma.learningPath.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
    if (!result.count) return res.status(404).json({ ok: false, code: "PATH_NOT_FOUND", message: "Trilha nao encontrada." });
    return res.status(204).end();
  } catch (error) { next(error); }
});
router.post("/:id/generate", generationLimiter, (req, res, next) => runGeneration(req, res, next, false));
router.post("/:id/reorganize", generationLimiter, (req, res, next) => runGeneration(req, res, next, true));
router.post("/:id/duplicate", writeLimiter, async (req, res, next) => {
  try {
    const path = await duplicatePath(prisma, req.user.id, req.params.id);
    if (!path) return res.status(404).json({ ok: false, code: "PATH_NOT_FOUND", message: "Trilha nao encontrada." });
    return res.status(201).json({ ok: true, path });
  } catch (error) { next(error); }
});
router.post("/:id/items", writeLimiter, async (req, res, next) => {
  try {
    const body = req.body || {};
    if (typeof body.videoId !== "string" || body.videoId.length > 100) return res.status(400).json({ ok: false, code: "INVALID_ITEM", message: "videoId invalido." });
    const result = await addPathItem(prisma, req.user.id, req.params.id, body);
    if (result.notFound) return res.status(404).json({ ok: false, code: "PATH_NOT_FOUND", message: "Trilha nao encontrada." });
    if (result.videoNotFound) return res.status(404).json({ ok: false, code: "VIDEO_NOT_FOUND", message: "Item nao encontrado na sua conta." });
    return res.status(201).json({ ok: true, path: result.path });
  } catch (error) { next(error); }
});
router.patch("/:id/items/:itemId", writeLimiter, async (req, res, next) => {
  try {
    const invalid = validateItemPatch(req.body || {});
    if (invalid) return res.status(400).json({ ok: false, code: "INVALID_ITEM", message: invalid });
    const path = await updatePathItem(prisma, req.user.id, req.params.id, req.params.itemId, req.body || {});
    if (!path) return res.status(404).json({ ok: false, code: "PATH_ITEM_NOT_FOUND", message: "Item da trilha nao encontrado." });
    return res.json({ ok: true, path });
  } catch (error) { next(error); }
});
router.delete("/:id/items/:itemId", writeLimiter, async (req, res, next) => {
  try {
    const removed = await removePathItem(prisma, req.user.id, req.params.id, req.params.itemId);
    if (!removed) return res.status(404).json({ ok: false, code: "PATH_ITEM_NOT_FOUND", message: "Item da trilha nao encontrado." });
    return res.status(204).end();
  } catch (error) { next(error); }
});
router.post("/:id/items/reorder", writeLimiter, async (req, res, next) => {
  try {
    if (!Array.isArray(req.body?.items)) return res.status(400).json({ ok: false, code: "INVALID_ORDER", message: "items deve ser uma lista." });
    const path = await reorderPathItems(prisma, req.user.id, req.params.id, req.body.items);
    if (!path) return res.status(404).json({ ok: false, code: "PATH_NOT_FOUND", message: "Trilha nao encontrada." });
    return res.json({ ok: true, path });
  } catch (error) { next(error); }
});
router.patch("/:id/gaps/:gapId", writeLimiter, async (req, res, next) => {
  try {
    const path = await updateGap(prisma, req.user.id, req.params.id, req.params.gapId, req.body || {});
    if (!path) return res.status(404).json({ ok: false, code: "GAP_NOT_FOUND", message: "Lacuna nao encontrada." });
    return res.json({ ok: true, path });
  } catch (error) { next(error); }
});

function conditionalGenerationLimit(req, res, next) {
  if (req.body?.autoOrganize === true) return generationLimiter(req, res, next);
  return next();
}

async function runGeneration(req, res, next, reorganize) {
  const key = `${req.user.id}:${req.params.id}`;
  if (activeGenerations.has(key)) return res.status(409).json({ ok: false, code: "PATH_GENERATION_IN_PROGRESS", message: "Esta trilha ja esta sendo organizada." });
  activeGenerations.add(key);
  try {
    const result = await generatePath({ prisma, userId: req.user.id, pathId: req.params.id, reorganize });
    if (result.notFound) return res.status(404).json({ ok: false, code: "PATH_NOT_FOUND", message: "Trilha nao encontrada." });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return next(error);
  } finally {
    activeGenerations.delete(key);
  }
}

function validateItemPatch(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "Payload de item invalido.";
  for (const [field, max] of [["section", 120], ["reason", 320], ["note", 600]]) {
    if (body[field] !== undefined && (typeof body[field] !== "string" || body[field].length > max * 2)) return `${field} invalido.`;
  }
  if (body.status !== undefined && !["pending", "in_progress", "completed", "skipped"].includes(body.status)) return "Status de item invalido.";
  if (body.estimatedMinutes !== undefined && (!Number.isInteger(Number(body.estimatedMinutes)) || Number(body.estimatedMinutes) < 1 || Number(body.estimatedMinutes) > 600)) return "Tempo estimado invalido.";
  return null;
}

export default router;
