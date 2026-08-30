import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { prisma } from "../db/prisma.js";
import { createOrRegenerateCapsule, deleteCapsuleForUser, getCapsuleForUser } from "../capsules/capsuleService.js";
import { validateCapsulePayload } from "../capsules/capsuleSchema.js";

const router = express.Router();
const capsuleWriteLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  keyPrefix: "capsule-write",
  message: "Limite de criacao de capsulas atingido. Tente novamente mais tarde.",
});

router.use(requireAuth);

router.get("/:id/capsule", async (req, res, next) => {
  try {
    const result = await getCapsuleForUser(prisma, req.user.id, req.params.id);
    if (result.notFound) return res.status(404).json({ ok: false, message: "Item nao encontrado." });
    return res.json({ ok: true, capsule: result.capsule });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/capsule", capsuleWriteLimit, handleCreate(false));
router.post("/:id/capsule/regenerate", capsuleWriteLimit, handleCreate(true));

router.delete("/:id/capsule", capsuleWriteLimit, async (req, res, next) => {
  try {
    const deleted = await deleteCapsuleForUser(prisma, req.user.id, req.params.id);
    if (!deleted) return res.status(404).json({ ok: false, message: "Item ou capsula nao encontrada." });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

function handleCreate(force) {
  return async (req, res, next) => {
    try {
      const validation = validateCapsulePayload(req.body || {});
      if (!validation.ok) return res.status(400).json({ ok: false, code: "INVALID_PAYLOAD", message: validation.message });
      const result = await createOrRegenerateCapsule({
        prisma,
        userId: req.user.id,
        videoId: req.params.id,
        input: validation.value,
        force,
      });
      if (result.notFound) return res.status(404).json({ ok: false, message: "Item nao encontrado." });
      return res.status(result.failed ? 503 : result.reused ? 200 : 201).json({
        ok: !result.failed,
        message: result.failed ? result.capsule?.errorMessage : undefined,
        ...result,
      });
    } catch (error) {
      return next(error);
    }
  };
}

export default router;
