import express from "express";
import { createHash, randomBytes } from "node:crypto";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../db/prisma.js";

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const rows = await prisma.captureToken.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, lastUsedAt: true, revokedAt: true, createdAt: true } });
    res.json(rows);
  } catch (error) { next(error); }
});

router.post("/", async (req, res, next) => {
  try {
    const raw = `gcp_${randomBytes(24).toString("base64url")}`;
    const tokenHash = createHash("sha256").update(raw).digest("hex");
    const row = await prisma.captureToken.create({ data: { userId: req.user.id, name: String(req.body?.name || "Extensao").trim().slice(0, 80) || "Extensao", tokenHash } });
    res.status(201).json({ id: row.id, name: row.name, token: raw, createdAt: row.createdAt, warning: "Este token aparece somente agora." });
  } catch (error) { next(error); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const result = await prisma.captureToken.updateMany({ where: { id: req.params.id, userId: req.user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (!result.count) return res.status(404).json({ ok: false, message: "Token nao encontrado." });
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;
