import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../db/prisma.js";
import { synthesizeKnowledge } from "../everywhere/synthesisService.js";
const router = express.Router(); router.use(requireAuth);
router.get("/", async (req, res, next) => { try { res.json(await synthesizeKnowledge(prisma, req.user.id, req.query.q)); } catch (error) { next(error); } });
export default router;
