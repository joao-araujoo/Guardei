import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../db/prisma.js";
import { getKnowledgeDashboard } from "../knowledge/knowledgeService.js";

const router = express.Router();
router.use(requireAuth);

router.get("/dashboard", async (req, res, next) => {
  try {
    const days = req.query.days === undefined ? 30 : Number(req.query.days);
    if (!Number.isInteger(days) || days < 7 || days > 365) return res.status(400).json({ ok: false, code: "PERIOD_INVALID", message: "O periodo deve estar entre 7 e 365 dias." });
    return res.json(await getKnowledgeDashboard({ prisma, userId: req.user.id, days }));
  } catch (error) { return next(error); }
});

export default router;
