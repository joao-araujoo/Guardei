import express from "express";
import { classifyTikTokWithGemini, classifyVideoWithGemini } from "../ai/geminiClassifier.js";

const router = express.Router();

async function getOEmbed(url, platform) {
  if (!["youtube", "tiktok"].includes(platform)) return null;

  const endpoint =
    platform === "youtube"
      ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`
      : `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) return null;
    const data = await response.json();

    return {
      title: data.title || "",
      author: data.author_name || "",
      author_url: data.author_url || "",
      thumbnail_url: data.thumbnail_url || "",
      html: data.html || "",
      provider_name: data.provider_name || (platform === "youtube" ? "YouTube" : "TikTok"),
    };
  } catch (error) {
    console.error(`Erro ao buscar oEmbed de ${platform}:`, error);
    return null;
  }
}

router.post("/enrich-video", async (req, res) => {
  try {
    const { url, title = "", text = "", description = "", platform: incomingPlatform = "" } = req.body || {};

    if (!url || typeof url !== "string") {
      return res.status(400).json({ ok: false, message: "URL do link e obrigatoria." });
    }

    const platform = detectPlatform(url, incomingPlatform);
    const oembed = await getOEmbed(url, platform);
    const finalTitle = title || oembed?.title || "";
    const finalDescription = [description, text].filter(Boolean).join("\n").trim();
    const author = oembed?.author || "";
    const classification = await classifyVideoWithGemini({
      url,
      title: finalTitle,
      description: finalDescription,
      author,
      platform,
    });

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
    console.error("Erro na rota /enrich-video:", error);
    return res.status(500).json({ ok: false, message: "Erro ao enriquecer link." });
  }
});

router.post("/classify-tiktok", async (req, res) => {
  try {
    const { url, title = "", description = "" } = req.body || {};

    if (!url || typeof url !== "string") {
      return res.status(400).json({
        ok: false,
        message: "URL do TikTok e obrigatoria.",
      });
    }

    const oembed = await getOEmbed(url, "tiktok");
    const finalTitle = title || oembed?.title || "";
    const author = oembed?.author || "";

    const ai = await classifyTikTokWithGemini({
      url,
      title: finalTitle,
      description,
      author,
    });

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
    console.error("Erro na rota /classify-tiktok:", error);

    return res.status(500).json({
      ok: false,
      message: "Erro ao classificar video.",
    });
  }
});

function detectPlatform(url, fallback = "") {
  const source = `${url} ${fallback}`.toLowerCase();
  if (source.includes("youtube.com") || source.includes("youtu.be")) return "youtube";
  if (source.includes("tiktok.com") || source.includes("vm.tiktok.com") || source.includes("vt.tiktok.com")) return "tiktok";
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
  const labels = {
    youtube: "YouTube",
    tiktok: "TikTok",
    twitter: "X/Twitter",
    instagram: "Instagram",
    spotify: "Spotify",
    pinterest: "Pinterest",
    reddit: "Reddit",
    linkedin: "LinkedIn",
    substack: "Substack",
    medium: "Medium",
    github: "GitHub",
    netflix: "Netflix",
    twitch: "Twitch",
    web: "Internet",
  };
  return labels[platform] || "Internet";
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

    const match = parsed.pathname.match(/\/video\/(\d+)/);
    return match?.[1] || parsed.pathname.split("/").filter(Boolean).slice(-1)[0] || "";
  } catch {
    return "";
  }
}

export default router;
