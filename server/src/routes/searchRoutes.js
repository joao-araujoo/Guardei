import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { prisma } from "../db/prisma.js";
import { hybridSearch } from "../search/searchService.js";
import { ensureVideoEmbedding } from "../embeddings/embeddingService.js";

const router = express.Router();
const searchRateLimit = createRateLimiter({ windowMs: 60_000, limit: 45, keyPrefix: "semantic-search" });
const indexRateLimit = createRateLimiter({ windowMs: 10 * 60_000, limit: 20, keyPrefix: "embedding-index" });

router.use(requireAuth);

router.get("/", searchRateLimit, async (req, res, next) => {
  try {
    const invalid = validateRawQuery(req.query);
    if (invalid) return res.status(400).json({ ok: false, code: "INVALID_SEARCH", message: invalid });
    const result = await hybridSearch({ prisma, userId: req.user.id, params: req.query });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return next(error);
  }
});

router.post("/reindex/:videoId", indexRateLimit, async (req, res, next) => {
  try {
    if (!isSafeId(req.params.videoId)) return res.status(400).json({ ok: false, code: "INVALID_VIDEO_ID", message: "Identificador de item invalido." });
    const result = await ensureVideoEmbedding({ prisma, userId: req.user.id, videoId: req.params.videoId, force: true });
    if (result.notFound) return res.status(404).json({ ok: false, code: "VIDEO_NOT_FOUND", message: "Item nao encontrado." });
    return res.json({ ok: true, status: result.embedding?.status || "failed" });
  } catch (error) {
    return next(error);
  }
});

function validateRawQuery(query) {
  if (Array.isArray(query.q) || String(query.q || "").length > 1_200) return "Consulta invalida ou muito longa.";
  for (const field of ["category", "status", "platform", "mood", "duration", "priority"]) {
    const value = query[field];
    if (value !== undefined && (Array.isArray(value) || !/^[a-zA-Z0-9_-]{1,80}$/.test(String(value)))) return `Filtro ${field} invalido.`;
  }
  if (query.hasCapsule !== undefined && !["", "true", "false", "1", "0"].includes(String(query.hasCapsule))) return "Filtro hasCapsule invalido.";
  if (query.mode !== undefined && !["hybrid", "text"].includes(String(query.mode))) return "Modo de busca invalido.";
  for (const [field, max] of [["limit", 50], ["offset", 5_000]]) {
    if (query[field] === undefined) continue;
    if (Array.isArray(query[field]) || !/^\d+$/.test(String(query[field])) || Number(query[field]) > max) return `${field} invalido.`;
  }
  return null;
}

function isSafeId(value) {
  return /^[a-zA-Z0-9_-]{1,100}$/.test(String(value || ""));
}

export default router;
