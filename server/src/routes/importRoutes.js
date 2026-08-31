import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { prisma } from "../db/prisma.js";
import { scheduleEmbeddingRefresh } from "../embeddings/embeddingService.js";
import { scheduleContentSnapshot } from "../everywhere/snapshotService.js";
import { parseAndValidateUrl } from "../security/urlSafety.js";

const router = express.Router();
const bookmarkImportRateLimit = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 6,
  keyPrefix: "bookmark-import",
  message: "Muitas importacoes em pouco tempo. Aguarde alguns minutos e tente novamente.",
});

router.use(requireAuth);
router.post("/bookmarks", bookmarkImportRateLimit, async (req, res, next) => {
  try {
    const items = parseImport(req.body || {}).slice(0, 500);
    let created = 0; let duplicated = 0; let invalid = 0;
    for (const item of items) {
      try {
        const url = parseAndValidateUrl(item.url).toString();
        const existing = await prisma.video.findFirst({ where: { userId: req.user.id, OR: [{ url }, { canonicalUrl: url }] } });
        if (existing) { duplicated += 1; continue; }
        const title = clean(item.title, 500) || new URL(url).hostname;
        const video = await prisma.video.create({ data: { userId: req.user.id, url, canonicalUrl: url, platform: "web", platformLabel: "Favoritos", titleOriginal: title, titleAi: title, category: "misc", reason: "guardar", savedFor: "ver-depois", tags: ["importado"], priority: "baixa", status: "inbox", origin: "bookmark-import", schemaVersion: 4 } });
        scheduleEmbeddingRefresh(prisma, req.user.id, video.id);
        scheduleContentSnapshot(prisma, req.user.id, video.id);
        created += 1;
      } catch {
        invalid += 1;
      }
    }
    res.json({ total: items.length, created, duplicated, invalid });
  } catch (error) {
    next(error);
  }
});

function parseImport(body) {
  if (Array.isArray(body.items)) return body.items.map(item => ({ url: String(item?.url || ""), title: String(item?.title || "") }));
  const content = String(body.content || ""); const format = String(body.format || "html").toLowerCase();
  if (format === "html") return [...content.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(match => ({ url: decode(match[1]), title: strip(match[2]) }));
  if (format === "csv") return content.split(/\r?\n/).map(line => { const parts = line.split(","); const urlIndex = parts.findIndex(part => /^\s*https?:\/\//i.test(part.replace(/^"|"$/g, ""))); return urlIndex >= 0 ? { url: parts[urlIndex].replace(/^"|"$/g, "").trim(), title: (parts[urlIndex === 0 ? 1 : 0] || "").replace(/^"|"$/g, "").trim() } : null; }).filter(Boolean);
  return [];
}
function decode(value) { return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim(); }
function strip(value) { return value.replace(/<[^>]+>/g, " ").replace(/&[^;]+;/g, " ").replace(/\s+/g, " ").trim(); }
function clean(value, max) { return String(value || "").replace(/[\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max); }
export default router;
