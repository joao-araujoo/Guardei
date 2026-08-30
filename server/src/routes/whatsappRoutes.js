import express from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "../db/prisma.js";
import { captureUrlForUser } from "../everywhere/captureService.js";

const router = express.Router();
router.get("/", (req, res) => { const mode = req.query["hub.mode"]; const token = req.query["hub.verify_token"]; const challenge = req.query["hub.challenge"]; if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) return res.status(200).send(challenge); return res.status(403).end(); });
router.post("/", async (req, res, next) => {
  try {
    if (!validSignature(req)) return res.status(401).json({ ok: false });
    const messages = extractMessages(req.body);
    for (const message of messages) await handleMessage(message);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

async function handleMessage(message) {
  const text = String(message.text || "").trim(); if (!text) return;
  const code = text.match(/^GUARDEI\s+(GUA-[A-F0-9]{6})$/i)?.[1]?.toUpperCase();
  if (code) {
    const link = await prisma.integrationLink.findFirst({ where: { code, provider: "whatsapp", usedAt: null, expiresAt: { gt: new Date() } } });
    if (!link) return sendText(message.from, "Esse codigo do Guardei expirou ou nao existe.");
    await prisma.integrationAccount.upsert({ where: { provider_externalUserId: { provider: "whatsapp", externalUserId: message.from } }, create: { userId: link.userId, provider: "whatsapp", externalUserId: message.from, displayName: message.name || null }, update: { userId: link.userId, displayName: message.name || null } });
    await prisma.integrationLink.update({ where: { id: link.id }, data: { usedAt: new Date() } });
    return sendText(message.from, "Pronto. Esse WhatsApp agora guarda coisas no seu Guardei.");
  }
  const account = await prisma.integrationAccount.findUnique({ where: { provider_externalUserId: { provider: "whatsapp", externalUserId: message.from } } });
  if (!account) return sendText(message.from, "Abra o Guardei, gere um codigo em Integracoes e envie: GUARDEI SEU-CODIGO");
  const url = text.match(/https?:\/\/[^\s]+/i)?.[0];
  if (url) {
    const result = await captureUrlForUser(prisma, account.userId, { url, text: text.replace(url, "").trim(), origin: "whatsapp", savedFor: "ver-depois" });
    return sendText(message.from, result.duplicated ? "Isso ja estava guardado. Trouxe de volta pra sua memoria." : "Guardado. Eu organizo o resto por aqui.");
  }
  await prisma.quickThought.create({ data: { userId: account.userId, text: text.slice(0, 8000), tags: ["whatsapp"] } });
  return sendText(message.from, "Anotado no seu Guardei.");
}

function extractMessages(body) { const out = []; for (const entry of body?.entry || []) for (const change of entry?.changes || []) { const contacts = change?.value?.contacts || []; for (const msg of change?.value?.messages || []) if (msg?.type === "text") out.push({ from: msg.from, text: msg.text?.body, name: contacts.find(c => c.wa_id === msg.from)?.profile?.name || "" }); } return out; }
function validSignature(req) { const secret = String(process.env.WHATSAPP_APP_SECRET || ""); if (!secret) return true; const provided = String(req.get("x-hub-signature-256") || ""); const expected = `sha256=${createHmac("sha256", secret).update(req.rawBody || Buffer.from(JSON.stringify(req.body || {}))).digest("hex")}`; if (provided.length !== expected.length) return false; return timingSafeEqual(Buffer.from(provided), Buffer.from(expected)); }
async function sendText(to, body) { const token = process.env.WHATSAPP_ACCESS_TOKEN; const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID; if (!token || !phoneId || !to) return false; try { await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(phoneId)}/messages`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: String(body).slice(0, 1000) } }), signal: AbortSignal.timeout(8000) }); return true; } catch { return false; } }
export default router;
