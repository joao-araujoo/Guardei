import express from "express";
import { randomBytes } from "node:crypto";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../db/prisma.js";
import { scheduleEmbeddingRefresh } from "../embeddings/embeddingService.js";

const router = express.Router();
router.get("/public/:slug", async (req, res, next) => { try { const collection = await getPublic(req.params.slug); if (!collection) return res.status(404).json({ ok: false, message: "Colecao nao encontrada." }); res.json(serialize(collection)); } catch (error) { next(error); } });
router.post("/public/:slug/import", requireAuth, async (req, res, next) => {
  try {
    const collection = await getPublic(req.params.slug); if (!collection) return res.status(404).json({ ok: false, message: "Colecao nao encontrada." });
    let created = 0; let duplicated = 0;
    for (const entry of collection.items) {
      const source = entry.video; const exists = await prisma.video.findFirst({ where: { userId: req.user.id, url: source.url } });
      if (exists) { duplicated += 1; continue; }
      const copy = await prisma.video.create({ data: { userId: req.user.id, url: source.url, canonicalUrl: source.canonicalUrl || source.url, platform: source.platform, platformLabel: source.platformLabel, titleOriginal: source.titleOriginal, titleAi: source.titleAi, titleCustom: source.titleCustom, authorName: source.authorName, thumbnailUrl: source.thumbnailUrl, description: source.description, category: source.category, reason: source.reason, savedFor: source.savedFor || source.reason, tags: source.tags, priority: source.priority, status: "inbox", note: entry.note || source.note, summary: source.summary, mood: source.mood, effort: source.effort, durationBucket: source.durationBucket, bestFor: source.bestFor, watchWhen: source.watchWhen, origin: "shared-collection", schemaVersion: 4 } });
      scheduleEmbeddingRefresh(prisma, req.user.id, copy.id); created += 1;
    }
    res.json({ created, duplicated, total: collection.items.length });
  } catch (error) { next(error); }
});
router.use(requireAuth);
router.get("/", async (req, res, next) => { try { const rows = await prisma.sharedCollection.findMany({ where: { userId: req.user.id }, include: { items: { select: { id: true } } }, orderBy: { updatedAt: "desc" } }); res.json(rows.map(row => ({ ...row, itemCount: row.items.length, items: undefined }))); } catch (error) { next(error); } });
router.post("/", async (req, res, next) => {
  try {
    const title = clean(req.body?.title, 140); if (!title) return res.status(400).json({ ok: false, message: "Titulo obrigatorio." });
    const collection = await prisma.sharedCollection.create({ data: { userId: req.user.id, title, description: clean(req.body?.description, 1000) || null, isPublic: req.body?.isPublic !== false, slug: `${slugify(title)}-${randomBytes(4).toString("hex")}`, items: { create: await validItems(req.user.id, req.body?.videoIds) } }, include: { items: { include: { video: true }, orderBy: { position: "asc" } } } });
    res.status(201).json(serialize(collection));
  } catch (error) { next(error); }
});
router.patch("/:id", async (req, res, next) => { try { const data = {}; if (req.body?.title !== undefined) data.title = clean(req.body.title, 140); if (req.body?.description !== undefined) data.description = clean(req.body.description, 1000) || null; if (req.body?.isPublic !== undefined) data.isPublic = Boolean(req.body.isPublic); const result = await prisma.sharedCollection.updateMany({ where: { id: req.params.id, userId: req.user.id }, data }); if (!result.count) return res.status(404).json({ ok: false, message: "Colecao nao encontrada." }); res.json({ ok: true }); } catch (error) { next(error); } });
router.post("/:id/items", async (req, res, next) => { try { const collection = await prisma.sharedCollection.findFirst({ where: { id: req.params.id, userId: req.user.id }, include: { items: true } }); if (!collection) return res.status(404).json({ ok: false, message: "Colecao nao encontrada." }); const ids = Array.isArray(req.body?.videoIds) ? req.body.videoIds : [req.body?.videoId].filter(Boolean); const videos = await prisma.video.findMany({ where: { userId: req.user.id, id: { in: ids } }, select: { id: true } }); let position = collection.items.length; for (const video of videos) await prisma.sharedCollectionItem.upsert({ where: { collectionId_videoId: { collectionId: collection.id, videoId: video.id } }, create: { collectionId: collection.id, videoId: video.id, position: position++ }, update: {} }); res.json({ added: videos.length }); } catch (error) { next(error); } });
router.delete("/:id/items/:videoId", async (req, res, next) => { try { const collection = await prisma.sharedCollection.findFirst({ where: { id: req.params.id, userId: req.user.id }, select: { id: true } }); if (!collection) return res.status(404).json({ ok: false, message: "Colecao nao encontrada." }); await prisma.sharedCollectionItem.deleteMany({ where: { collectionId: collection.id, videoId: req.params.videoId } }); res.status(204).end(); } catch (error) { next(error); } });
router.delete("/:id", async (req, res, next) => { try { const result = await prisma.sharedCollection.deleteMany({ where: { id: req.params.id, userId: req.user.id } }); if (!result.count) return res.status(404).json({ ok: false, message: "Colecao nao encontrada." }); res.status(204).end(); } catch (error) { next(error); } });

async function getPublic(slug) { return prisma.sharedCollection.findFirst({ where: { slug, isPublic: true }, include: { user: { select: { name: true } }, items: { include: { video: true }, orderBy: { position: "asc" } } } }); }
async function validItems(userId, ids) { const list = Array.isArray(ids) ? ids.slice(0, 100) : []; const videos = await prisma.video.findMany({ where: { userId, id: { in: list } }, select: { id: true } }); return videos.map((video, position) => ({ videoId: video.id, position })); }
function serialize(collection) { return { id: collection.id, slug: collection.slug, title: collection.title, description: collection.description, isPublic: collection.isPublic, curator: collection.user?.name || null, createdAt: collection.createdAt, updatedAt: collection.updatedAt, items: (collection.items || []).map(entry => ({ id: entry.id, position: entry.position, note: entry.note, video: compact(entry.video) })) }; }
function compact(video) { if (!video) return null; return { id: video.id, url: video.url, platform: video.platform, title: video.titleCustom || video.titleAi || video.titleOriginal, thumbnailUrl: video.thumbnailUrl, category: video.category, tags: video.tags, summary: video.summary, savedFor: video.savedFor }; }
function slugify(value) { return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "guardei"; }
function clean(value, max) { return String(value || "").replace(/[\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max); }
export default router;
