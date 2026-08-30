import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../db/prisma.js";

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try { res.json(fromDbSettings(await getOrCreateSettings(req.user.id))); } catch (error) { next(error); }
});

router.patch("/", async (req, res, next) => {
  try {
    const patch = req.body || {};
    const create = {
      userId: req.user.id,
      dailyReviewTarget: normalizeDailyTarget(patch.dailyReviewTarget),
      autoOpenReviewAfterShare: Boolean(patch.autoOpenReviewAfterShare),
      smartNotificationsEnabled: Boolean(patch.smartNotificationsEnabled),
      clipboardSuggestionsEnabled: patch.clipboardSuggestionsEnabled === undefined ? true : Boolean(patch.clipboardSuggestionsEnabled),
      guardinhoActionsEnabled: patch.guardinhoActionsEnabled === undefined ? true : Boolean(patch.guardinhoActionsEnabled),
      recommendationMode: normalizeRecommendationMode(patch.recommendationMode),
      notificationFrequency: normalizeNotificationFrequency(patch.notificationFrequency),
      weeklyDigestEnabled: patch.weeklyDigestEnabled === undefined ? true : Boolean(patch.weeklyDigestEnabled),
      autoSnapshotEnabled: patch.autoSnapshotEnabled === undefined ? true : Boolean(patch.autoSnapshotEnabled),
      contextAssistEnabled: patch.contextAssistEnabled === undefined ? true : Boolean(patch.contextAssistEnabled),
      screenshotOcrEnabled: patch.screenshotOcrEnabled === undefined ? true : Boolean(patch.screenshotOcrEnabled),
      extensionCaptureEnabled: patch.extensionCaptureEnabled === undefined ? true : Boolean(patch.extensionCaptureEnabled),
      timezone: normalizeTimezone(patch.timezone),
    };
    const update = {};
    for (const field of ["autoOpenReviewAfterShare", "smartNotificationsEnabled", "clipboardSuggestionsEnabled", "guardinhoActionsEnabled", "weeklyDigestEnabled", "autoSnapshotEnabled", "contextAssistEnabled", "screenshotOcrEnabled", "extensionCaptureEnabled"]) {
      if (patch[field] !== undefined) update[field] = Boolean(patch[field]);
    }
    if (patch.dailyReviewTarget !== undefined) update.dailyReviewTarget = normalizeDailyTarget(patch.dailyReviewTarget);
    if (patch.recommendationMode !== undefined) update.recommendationMode = normalizeRecommendationMode(patch.recommendationMode);
    if (patch.notificationFrequency !== undefined) update.notificationFrequency = normalizeNotificationFrequency(patch.notificationFrequency);
    if (patch.timezone !== undefined) update.timezone = normalizeTimezone(patch.timezone);
    const settings = await prisma.userSettings.upsert({ where: { userId: req.user.id }, create, update });
    res.json(fromDbSettings(settings));
  } catch (error) { next(error); }
});

async function getOrCreateSettings(userId) { return prisma.userSettings.upsert({ where: { userId }, create: { userId }, update: {} }); }
function normalizeDailyTarget(value) { const target = Number(value || 3); return Number.isFinite(target) ? Math.min(10, Math.max(1, Math.round(target))) : 3; }
function normalizeRecommendationMode(value) { return ["smart", "manual"].includes(value) ? value : "smart"; }
function normalizeNotificationFrequency(value) { return ["light", "balanced", "frequent"].includes(value) ? value : "balanced"; }
function normalizeTimezone(value) { const text = String(value || "America/Sao_Paulo").trim(); return /^[A-Za-z_]+\/[A-Za-z_+-]+(?:\/[A-Za-z_+-]+)?$/.test(text) ? text.slice(0, 80) : "America/Sao_Paulo"; }
function fromDbSettings(settings) {
  return {
    dailyReviewTarget: settings.dailyReviewTarget, autoOpenReviewAfterShare: settings.autoOpenReviewAfterShare,
    storageMode: settings.storageMode, backendReady: settings.backendReady,
    smartNotificationsEnabled: settings.smartNotificationsEnabled, clipboardSuggestionsEnabled: settings.clipboardSuggestionsEnabled,
    guardinhoActionsEnabled: settings.guardinhoActionsEnabled, recommendationMode: settings.recommendationMode,
    notificationFrequency: settings.notificationFrequency, weeklyDigestEnabled: settings.weeklyDigestEnabled,
    autoSnapshotEnabled: settings.autoSnapshotEnabled, contextAssistEnabled: settings.contextAssistEnabled,
    screenshotOcrEnabled: settings.screenshotOcrEnabled, extensionCaptureEnabled: settings.extensionCaptureEnabled,
    timezone: settings.timezone,
  };
}
export default router;
