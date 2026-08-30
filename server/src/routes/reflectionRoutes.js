import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../db/prisma.js";
import { validateReflectionPayload } from "../reviews/reviewSchema.js";
import { serializeReflection } from "../reviews/reviewService.js";

const router = express.Router();
router.use(requireAuth);

router.get("/:id/reflection", async (req, res, next) => {
  try {
    const reflection = await prisma.contentReflection.findFirst({ where: { userId: req.user.id, videoId: req.params.id } });
    return res.json({ reflection: serializeReflection(reflection) });
  } catch (error) { return next(error); }
});

router.post("/:id/reflection", async (req, res, next) => {
  try {
    const video = await prisma.video.findFirst({ where: { id: req.params.id, userId: req.user.id }, select: { id: true } });
    if (!video) return res.status(404).json({ ok: false, code: "VIDEO_NOT_FOUND", message: "Conteudo nao encontrado." });
    const payload = validateReflectionPayload(req.body || {});
    const reflection = await prisma.contentReflection.upsert({
      where: { videoId: video.id },
      create: { userId: req.user.id, videoId: video.id, ...payload },
      update: payload,
    });
    return res.status(201).json({ reflection: serializeReflection(reflection) });
  } catch (error) { return next(error); }
});

export default router;
