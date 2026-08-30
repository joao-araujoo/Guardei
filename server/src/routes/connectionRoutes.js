import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { prisma } from "../db/prisma.js";
import { buildKnowledgeMap, findRelatedItems } from "../connections/connectionService.js";

const router = express.Router();
const limiter = createRateLimiter({ windowMs: 60_000, limit: 40, keyPrefix: "connections" });
router.use(requireAuth, limiter);

router.get("/videos/:id/related", async (req, res, next) => {
  try {
    const result = await findRelatedItems({ prisma, userId: req.user.id, videoId: req.params.id, limit: req.query.limit });
    if (result.notFound) return res.status(404).json({ ok: false, code: "VIDEO_NOT_FOUND", message: "Item nao encontrado." });
    return res.json({ ok: true, items: result.items });
  } catch (error) {
    next(error);
  }
});

router.get("/connections/map", async (req, res, next) => {
  try {
    const filters = {
      category: safeToken(req.query.category),
      status: safeToken(req.query.status),
      pathId: safeId(req.query.pathId),
      limit: Math.min(80, Math.max(10, Number(req.query.limit) || 50)),
    };
    const map = await buildKnowledgeMap({ prisma, userId: req.user.id, filters });
    return res.json({ ok: true, ...map });
  } catch (error) {
    next(error);
  }
});

function safeToken(value) {
  const clean = String(value || "").trim();
  return /^[a-zA-Z0-9_-]{1,80}$/.test(clean) ? clean : undefined;
}
function safeId(value) {
  const clean = String(value || "").trim();
  return /^[a-zA-Z0-9_-]{5,80}$/.test(clean) ? clean : undefined;
}

export default router;
