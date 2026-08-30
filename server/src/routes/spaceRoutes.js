import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../db/prisma.js";
import { buildAutomaticSpaces } from "../everywhere/spaceService.js";
const router = express.Router(); router.use(requireAuth);
router.get("/", async (req, res, next) => { try { res.json({ spaces: await buildAutomaticSpaces(prisma, req.user.id) }); } catch (error) { next(error); } });
export default router;
