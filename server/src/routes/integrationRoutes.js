import express from "express";
import { randomBytes } from "node:crypto";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../db/prisma.js";
const router = express.Router(); router.use(requireAuth);
router.get("/", async (req, res, next) => { try { res.json(await prisma.integrationAccount.findMany({ where: { userId: req.user.id }, select: { id: true, provider: true, externalUserId: true, displayName: true, createdAt: true, updatedAt: true } })); } catch (error) { next(error); } });
router.post("/whatsapp/connect-code", async (req, res, next) => { try { const code = `GUA-${randomBytes(3).toString("hex").toUpperCase()}`; const row = await prisma.integrationLink.create({ data: { userId: req.user.id, provider: "whatsapp", code, expiresAt: new Date(Date.now() + 30 * 60 * 1000) } }); res.status(201).json({ code: row.code, expiresAt: row.expiresAt, instruction: `Envie GUARDEI ${row.code} para o numero conectado ao WhatsApp do Guardei.` }); } catch (error) { next(error); } });
router.delete("/:id", async (req, res, next) => { try { const result = await prisma.integrationAccount.deleteMany({ where: { id: req.params.id, userId: req.user.id } }); if (!result.count) return res.status(404).json({ ok: false, message: "Integracao nao encontrada." }); res.status(204).end(); } catch (error) { next(error); } });
export default router;
