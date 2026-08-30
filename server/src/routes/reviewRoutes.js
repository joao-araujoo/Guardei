import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../db/prisma.js";
import { getTodayHub } from "../reviews/reviewService.js";

const router = express.Router();
router.use(requireAuth);

router.get("/today", async (req, res, next) => {
  try {
    const data = await getTodayHub({ prisma, userId: req.user.id });
    return res.json(data);
  } catch (error) { return next(error); }
});

router.get("/session", async (req, res, next) => {
  try {
    const value = req.query.minutes === "complete" ? "full" : String(req.query.minutes || "5");
    if (!["2", "5", "10", "full"].includes(value)) return res.status(400).json({ ok: false, code: "SESSION_DURATION_INVALID", message: "Escolha uma sessao de 2, 5, 10 minutos ou completa." });
    const data = await getTodayHub({ prisma, userId: req.user.id });
    const key = value === "2" ? "two" : value === "5" ? "five" : value === "10" ? "ten" : "full";
    return res.json({ generatedAt: data.generatedAt, session: data.sessions[key] });
  } catch (error) { return next(error); }
});

export default router;
