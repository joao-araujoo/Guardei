import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../db/prisma.js";
import { captureContentSnapshot } from "../everywhere/snapshotService.js";

const router = express.Router();
router.use(requireAuth);

router.get("/:videoId", async (req, res, next) => {
  try {
    const snapshot = await prisma.contentSnapshot.findFirst({ where: { videoId: req.params.videoId, userId: req.user.id } });
    if (!snapshot) return res.status(404).json({ ok: false, message: "Snapshot ainda nao existe." });
    res.json(snapshot);
  } catch (error) { next(error); }
});

router.post("/:videoId", async (req, res, next) => {
  try {
    const snapshot = await captureContentSnapshot(prisma, req.user.id, req.params.videoId);
    if (!snapshot) return res.status(404).json({ ok: false, message: "Item nao encontrado ou snapshot desativado." });
    res.json(snapshot);
  } catch (error) { next(error); }
});

export default router;
