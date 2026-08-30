import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../db/prisma.js";
import { buildWeeklyDigest } from "../everywhere/digestService.js";

const router = express.Router(); router.use(requireAuth);
router.get("/weekly", async (req, res, next) => { try { const row = await prisma.weeklyDigest.findFirst({ where: { userId: req.user.id }, orderBy: { createdAt: "desc" } }); res.json(row || await buildWeeklyDigest(prisma, req.user.id)); } catch (error) { next(error); } });
router.post("/weekly", async (req, res, next) => { try { res.json(await buildWeeklyDigest(prisma, req.user.id)); } catch (error) { next(error); } });
export default router;
