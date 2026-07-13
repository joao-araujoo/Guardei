import express from "express";
import { chatWithMascotGemini, classifyTikTokWithGemini, classifyVideoWithGemini } from "../ai/geminiClassifier.js";
import { requireAuth } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { parseAndValidateUrl } from "../security/urlSafety.js";
import { prisma } from "../db/prisma.js";
import { selectRelevantKnowledge } from "../capsules/guardinhoContext.js";

const router = express.Router();
const aiRateLimit = createRateLimiter({ windowMs: 10 * 60 * 1000, limit: 30, keyPrefix: "ai" });
const chatRateLimit = createRateLimiter({ windowMs: 10 * 60 * 1000, limit: 20, keyPrefix: "ai-chat" });

router.use(requireAuth, aiRateLimit);

async function getOEmbed(url, platform) {
  if (!["youtube", "tiktok"].includes(platform)) return null;
  const endpoint = platform === "youtube"
    ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`
    : `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return {
      title: String(data.title || "").slice(0, 500),
      author: String(data.author_name || "").slice(0, 200),
      author_url: String(data.author_url || "").slice(0, 1000),
      thumbnail_url: String(data.thumbnail_url || "").slice(0, 1000),
      provider_name: String(data.provider_name || (platform === "youtube" ? "YouTube" : "TikTok")).slice(0, 100),
    };
  } catch {
    return null;
  }
}

router.post("/enrich-video", async (req, res, next) => {
  try {
    const body = readObject(req.body);
    const url = validatePublicInputUrl(readString(body.url, 2_000, "url", true));
    const title = readString(body.title, 500, "title");
    const text = readString(body.text, 10_000, "text");
    const description = readString(body.description, 10_000, "description");
    const incomingPlatform = readString(body.platform, 40, "platform");
    const platform = detectPlatform(url, incomingPlatform);
    const oembed = await getOEmbed(url, platform);
    const finalTitle = title || oembed?.title || "";
    const finalDescription = [description, text].filter(Boolean).join("\n").trim().slice(0, 12_000);
    const author = oembed?.author || "";
    const classification = await classifyVideoWithGemini({ url, title: finalTitle, description: finalDescription, author, platform });

    return res.json({
      ok: true,
      source: process.env.GEMINI_API_KEY ? "gemini" : "local-fallback",
      video: {
        url,
        canonicalUrl: url,
        platform,
        platformLabel: platformLabel(platform),
        videoId: extractVideoId(url, platform),
        titleOriginal: finalTitle,
        titleAi: classification.titleAi,
        authorName: author,
        authorUrl: oembed?.author_url || "",
        thumbnailUrl: oembed?.thumbnail_url || "",
        providerName: oembed?.provider_name || platformLabel(platform),
        description: finalDescription,
        category: classification.category,
        reason: classification.reason,
        priority: classification.priority,
        tags: classification.tags,
        summary: classification.summary,
        note: classification.note,
        mood: classification.mood,
        effort: classification.effort,
        durationBucket: classification.durationBucket,
        bestFor: classification.bestFor,
        watchWhen: classification.watchWhen,
        status: classification.category === "misc" ? "inbox" : "novo",
        ai: {
          engine: process.env.GEMINI_API_KEY ? "gemini" : "server-heuristic",
          confidence: classification.confidence,
          rationale: classification.rationale,
        },
      },
    });
  } catch (error) {
    if (error?.status === 400) return res.status(400).json({ ok: false, message: error.message });
    return next(error);
  }
});

router.post("/classify-tiktok", async (req, res, next) => {
  try {
    const body = readObject(req.body);
    const url = validatePublicInputUrl(readString(body.url, 2_000, "url", true));
    const title = readString(body.title, 500, "title");
    const description = readString(body.description, 10_000, "description");
    const oembed = await getOEmbed(url, "tiktok");
    const finalTitle = title || oembed?.title || "";
    const author = oembed?.author || "";
    const ai = await classifyTikTokWithGemini({ url, title: finalTitle, description, author });
    return res.json({
      ok: true,
      source: process.env.GEMINI_API_KEY ? "gemini" : "local-fallback",
      video: {
        url,
        title_original: finalTitle,
        author,
        thumbnail_url: oembed?.thumbnail_url || "",
        author_url: oembed?.author_url || "",
        provider_name: oembed?.provider_name || "TikTok",
      },
      ai,
    });
  } catch (error) {
    if (error?.status === 400) return res.status(400).json({ ok: false, message: error.message });
    return next(error);
  }
});

router.post("/mascot-chat", chatRateLimit, async (req, res, next) => {
  try {
    const body = readObject(req.body);
    const message = readString(body.message, 1_200, "message", true);
    const messages = readMessages(body.messages);
    const relevantItems = await selectRelevantKnowledge(prisma, req.user.id, message, 12);
    const stats = sanitizeStats(body.stats);
    const answer = await chatWithMascotGemini({ message, messages, videos: relevantItems, stats });
    return res.json({ ok: true, source: process.env.GEMINI_API_KEY ? "gemini" : "local-fallback", answer });
  } catch (error) {
    return next(error);
  }
});

function validatePublicInputUrl(value) {
  if (!value || typeof value !== "string") return "";
  return parseAndValidateUrl(value).toString();
}

function readObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw inputError("O payload deve ser um objeto JSON.");
  return value;
}

function readString(value, max, field, required = false) {
  if (value === undefined || value === null || value === "") {
    if (required) throw inputError(`${field} e obrigatorio.`);
    return "";
  }
  if (typeof value !== "string") throw inputError(`${field} deve ser um texto.`);
  const clean = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
  if (clean.length > max) throw inputError(`${field} excede o limite permitido.`);
  if (required && !clean) throw inputError(`${field} e obrigatorio.`);
  return clean;
}

function readMessages(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw inputError("messages deve ser uma lista.");
  return value.slice(-8).map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw inputError("Historico de mensagens invalido.");
    return {
      role: item.role === "user" ? "user" : "assistant",
      text: readString(item.text, 500, "messages.text"),
    };
  });
}

function sanitizeStats(value = {}) {
  if (value === undefined || value === null) value = {};
  if (typeof value !== "object" || Array.isArray(value)) throw inputError("stats deve ser um objeto.");
  return Object.fromEntries(["total", "watched", "minutes", "active", "inbox", "important"].map((key) => {
    const number = value[key] === undefined ? 0 : Number(value[key]);
    if (!Number.isFinite(number)) throw inputError(`stats.${key} deve ser numerico.`);
    return [key, Math.max(0, Math.min(number, 10_000_000))];
  }));
}

function inputError(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = "INVALID_PAYLOAD";
  return error;
}

function detectPlatform(url, fallback = "") {
  const source = `${url} ${fallback}`.toLowerCase();
  if (source.includes("youtube.com") || source.includes("youtu.be")) return "youtube";
  if (source.includes("tiktok.com")) return "tiktok";
  if (source.includes("twitter.com") || source.includes("x.com")) return "twitter";
  if (source.includes("instagram.com")) return "instagram";
  if (source.includes("spotify.com")) return "spotify";
  if (source.includes("pinterest.com")) return "pinterest";
  if (source.includes("reddit.com")) return "reddit";
  if (source.includes("linkedin.com")) return "linkedin";
  if (source.includes("substack.com")) return "substack";
  if (source.includes("medium.com")) return "medium";
  if (source.includes("github.com")) return "github";
  if (source.includes("netflix.com")) return "netflix";
  if (source.includes("twitch.tv")) return "twitch";
  return fallback || "web";
}

function platformLabel(platform) {
  return { youtube: "YouTube", tiktok: "TikTok", twitter: "X/Twitter", instagram: "Instagram", spotify: "Spotify", pinterest: "Pinterest", reddit: "Reddit", linkedin: "LinkedIn", substack: "Substack", medium: "Medium", github: "GitHub", netflix: "Netflix", twitch: "Twitch", web: "Internet" }[platform] || "Internet";
}

function extractVideoId(url, platform) {
  try {
    const parsed = new URL(url);
    if (platform === "youtube") {
      if (/youtu\.be$/i.test(parsed.hostname)) return parsed.pathname.split("/").filter(Boolean)[0] || "";
      if (parsed.searchParams.get("v")) return parsed.searchParams.get("v") || "";
      const parts = parsed.pathname.split("/").filter(Boolean);
      const marker = ["shorts", "embed", "live"].find((item) => parts.includes(item));
      return marker ? parts[parts.indexOf(marker) + 1] || "" : "";
    }
    return parsed.pathname.match(/\/video\/(\d+)/)?.[1] || parsed.pathname.split("/").filter(Boolean).slice(-1)[0] || "";
  } catch {
    return "";
  }
}

export default router;
