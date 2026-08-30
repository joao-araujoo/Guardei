import { classifyVideoWithGemini } from "../ai/geminiClassifier.js";
import { parseAndValidateUrl } from "../security/urlSafety.js";
import { scheduleEmbeddingRefresh } from "../embeddings/embeddingService.js";
import { scheduleContentSnapshot } from "./snapshotService.js";

export const SAVE_INTENTS = ["ver-depois", "aprender", "aplicar", "inspirar", "comprar", "refletir", "guardar"];

export async function captureUrlForUser(prisma, userId, input = {}) {
  const url = parseAndValidateUrl(String(input.url || "").trim()).toString();
  const existing = await prisma.video.findFirst({
    where: { userId, OR: [{ url }, { canonicalUrl: url }] },
  });
  const savedFor = normalizeSavedFor(input.savedFor);
  if (existing) {
    if (savedFor && savedFor !== existing.savedFor) {
      const updated = await prisma.video.update({
        where: { id: existing.id },
        data: { savedFor, reason: mapIntentToReason(savedFor), reviewedAt: new Date() },
      });
      return { video: updated, duplicated: true };
    }
    return { video: existing, duplicated: true };
  }

  const platform = detectPlatform(url);
  const title = clean(input.title, 500);
  const text = clean(input.text, 12_000);
  const classification = await classifyVideoWithGemini({ url, title, description: text, platform });
  const finalIntent = savedFor || normalizeSavedFor(classification.reason) || "guardar";
  const created = await prisma.video.create({
    data: {
      userId,
      url,
      canonicalUrl: url,
      platform,
      platformLabel: platformLabel(platform),
      titleOriginal: title || null,
      titleAi: classification.titleAi || title || "Link salvo para revisar",
      description: text || null,
      category: classification.category || "misc",
      reason: mapIntentToReason(finalIntent),
      savedFor: finalIntent,
      tags: Array.isArray(classification.tags) ? classification.tags.slice(0, 12) : [],
      priority: normalizePriority(classification.priority),
      status: classification.category === "misc" ? "inbox" : "novo",
      note: clean(input.note, 4000) || null,
      summary: classification.summary || null,
      mood: classification.mood || null,
      effort: classification.effort || null,
      durationBucket: classification.durationBucket || null,
      bestFor: classification.bestFor || null,
      watchWhen: classification.watchWhen || null,
      sourceText: [title, text].filter(Boolean).join(" ").slice(0, 16_000) || null,
      origin: clean(input.origin, 80) || "capture",
      schemaVersion: 4,
      aiEngine: process.env.GEMINI_API_KEY ? "gemini" : "server-heuristic",
      aiConfidence: Number.isFinite(classification.confidence) ? classification.confidence : null,
      aiRationale: classification.rationale || null,
    },
  });
  scheduleEmbeddingRefresh(prisma, userId, created.id);
  scheduleContentSnapshot(prisma, userId, created.id);
  return { video: created, duplicated: false };
}

export function normalizeSavedFor(value) {
  const cleanValue = String(value || "").trim().toLowerCase();
  return SAVE_INTENTS.includes(cleanValue) ? cleanValue : "";
}

export function mapIntentToReason(intent) {
  return intent === "ver-depois" ? "guardar" : normalizeSavedFor(intent) || "guardar";
}

function detectPlatform(value) {
  const host = new URL(value).hostname.toLowerCase();
  if (host.includes("youtube") || host === "youtu.be") return "youtube";
  if (host.includes("tiktok")) return "tiktok";
  if (host.includes("instagram")) return "instagram";
  if (host === "x.com" || host.includes("twitter")) return "twitter";
  if (host.includes("reddit")) return "reddit";
  if (host.includes("github")) return "github";
  if (host.includes("linkedin")) return "linkedin";
  if (host.includes("spotify")) return "spotify";
  return "web";
}

function platformLabel(platform) {
  return { youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram", twitter: "X/Twitter", reddit: "Reddit", github: "GitHub", linkedin: "LinkedIn", spotify: "Spotify", web: "Internet" }[platform] || "Internet";
}

function normalizePriority(value) {
  return ["baixa", "media", "alta"].includes(value) ? value : "baixa";
}

function clean(value, max) {
  return String(value || "").replace(/[\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
