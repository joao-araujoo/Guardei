import express from "express";
import { randomUUID } from "node:crypto";
import { requireCaptureOrAuth } from "../middleware/captureAuth.js";
import { prisma } from "../db/prisma.js";
import { captureUrlForUser, mapIntentToReason, normalizeSavedFor } from "../everywhere/captureService.js";
import { analyzeScreenshot } from "../everywhere/visionService.js";
import { hybridSearch } from "../search/searchService.js";
import { scheduleEmbeddingRefresh } from "../embeddings/embeddingService.js";

const router = express.Router();
router.use(requireCaptureOrAuth);

router.post("/url", async (req, res, next) => {
  try {
    const result = await captureUrlForUser(prisma, req.user.id, {
      ...req.body,
      origin: req.body?.origin || (req.captureTokenId ? "extension" : "quick-capture"),
    });
    res.status(result.duplicated ? 200 : 201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/screenshot", async (req, res, next) => {
  try {
    const settings = await prisma.userSettings.findUnique({
      where: { userId: req.user.id },
      select: { screenshotOcrEnabled: true },
    });
    const analysis = await analyzeScreenshot(req.body?.dataUrl, { enableAi: settings?.screenshotOcrEnabled !== false });
    const savedFor = normalizeSavedFor(req.body?.savedFor) || analysis.reason || "guardar";
    const syntheticId = randomUUID();
    const video = await prisma.video.create({
      data: {
        userId: req.user.id,
        url: `https://capture.guardei.local/screenshot/${syntheticId}`,
        canonicalUrl: `https://capture.guardei.local/screenshot/${syntheticId}`,
        platform: "screenshot",
        platformLabel: "Screenshot",
        titleOriginal: analysis.title,
        titleAi: analysis.title,
        description: analysis.text || analysis.summary,
        category: analysis.category,
        reason: mapIntentToReason(savedFor),
        savedFor,
        tags: [...new Set(["screenshot", ...(analysis.tags || [])])].slice(0, 12),
        priority: analysis.priority,
        status: analysis.category === "misc" ? "inbox" : "novo",
        note: String(req.body?.note || "").trim().slice(0, 4000) || null,
        summary: analysis.summary,
        sourceText: analysis.text || null,
        origin: req.captureTokenId ? "extension-screenshot" : "screenshot",
        schemaVersion: 4,
        aiEngine: settings?.screenshotOcrEnabled !== false && process.env.GEMINI_API_KEY ? "gemini-vision" : "local-fallback",
      },
    });
    await prisma.savedAsset.create({
      data: {
        userId: req.user.id,
        videoId: video.id,
        kind: "screenshot",
        mimeType: analysis.image.mimeType,
        data: analysis.image.bytes <= 1_100_000 ? analysis.image.dataUrl : null,
        ocrText: analysis.text || null,
      },
    });
    scheduleEmbeddingRefresh(prisma, req.user.id, video.id);
    res.status(201).json({ video, ocrText: analysis.text, originalStored: analysis.image.bytes <= 1_100_000 });
  } catch (error) {
    next(error);
  }
});

router.post("/thought", async (req, res, next) => {
  try {
    const text = String(req.body?.text || "").replace(/[\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim().slice(0, 8000);
    if (!text) return res.status(400).json({ ok: false, message: "Escreva alguma coisa para guardar." });
    const tags = Array.isArray(req.body?.tags)
      ? req.body.tags.map(item => String(item).trim().slice(0, 40)).filter(Boolean).slice(0, 10)
      : [];
    const contextUrl = String(req.body?.contextUrl || "").trim().slice(0, 2000) || null;
    const syntheticId = randomUUID();
    const title = text.length <= 86 ? text : `${text.slice(0, 83).trim()}…`;

    const [thought, video] = await prisma.$transaction([
      prisma.quickThought.create({ data: { userId: req.user.id, text, contextUrl, tags } }),
      prisma.video.create({
        data: {
          userId: req.user.id,
          url: `https://capture.guardei.local/thought/${syntheticId}`,
          canonicalUrl: `https://capture.guardei.local/thought/${syntheticId}`,
          platform: "thought",
          platformLabel: "Pensamento",
          titleOriginal: title,
          titleAi: title,
          description: text,
          category: "misc",
          reason: "refletir",
          savedFor: "refletir",
          tags: [...new Set(["pensamento", ...tags])].slice(0, 12),
          priority: "baixa",
          status: "novo",
          note: contextUrl ? `Contexto: ${contextUrl}` : null,
          summary: "Pensamento rápido guardado para reencontrar depois.",
          sourceText: text,
          origin: req.captureTokenId ? "extension-thought" : "quick-thought",
          schemaVersion: 4,
          aiEngine: "user-input",
        },
      }),
    ]);
    scheduleEmbeddingRefresh(prisma, req.user.id, video.id);
    res.status(201).json({ thought, video });
  } catch (error) {
    next(error);
  }
});

router.get("/context", async (req, res, next) => {
  try {
    const q = [req.query.title, req.query.text, req.query.url].filter(Boolean).join(" ").slice(0, 1200);
    if (!q.trim()) return res.json({ query: "", total: 0, results: [] });
    const settings = await prisma.userSettings.findUnique({ where: { userId: req.user.id }, select: { contextAssistEnabled: true } });
    if (settings && !settings.contextAssistEnabled) return res.json({ query: q, disabled: true, total: 0, results: [] });
    const result = await hybridSearch({ prisma, userId: req.user.id, params: { q, limit: 6, mode: "hybrid" } });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
