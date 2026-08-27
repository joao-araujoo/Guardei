import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../db/prisma.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const settings = await getOrCreateSettings(req.user.id);
    res.json(fromDbSettings(settings));
  } catch (error) {
    next(error);
  }
});

router.patch("/", async (req, res, next) => {
  try {
    const patch = req.body || {};
    const settings = await prisma.userSettings.upsert({
      where: { userId: req.user.id },
      create: {
        userId: req.user.id,
        dailyReviewTarget: normalizeDailyTarget(patch.dailyReviewTarget),
        autoOpenReviewAfterShare: Boolean(patch.autoOpenReviewAfterShare),
        smartNotificationsEnabled: Boolean(patch.smartNotificationsEnabled),
        clipboardSuggestionsEnabled: patch.clipboardSuggestionsEnabled === undefined ? true : Boolean(patch.clipboardSuggestionsEnabled),
        guardinhoActionsEnabled: patch.guardinhoActionsEnabled === undefined ? true : Boolean(patch.guardinhoActionsEnabled),
        recommendationMode: normalizeRecommendationMode(patch.recommendationMode),
        notificationFrequency: normalizeNotificationFrequency(patch.notificationFrequency),
      },
      update: {
        ...(patch.dailyReviewTarget !== undefined ? { dailyReviewTarget: normalizeDailyTarget(patch.dailyReviewTarget) } : {}),
        ...(patch.autoOpenReviewAfterShare !== undefined ? { autoOpenReviewAfterShare: Boolean(patch.autoOpenReviewAfterShare) } : {}),
        ...(patch.smartNotificationsEnabled !== undefined ? { smartNotificationsEnabled: Boolean(patch.smartNotificationsEnabled) } : {}),
        ...(patch.clipboardSuggestionsEnabled !== undefined ? { clipboardSuggestionsEnabled: Boolean(patch.clipboardSuggestionsEnabled) } : {}),
        ...(patch.guardinhoActionsEnabled !== undefined ? { guardinhoActionsEnabled: Boolean(patch.guardinhoActionsEnabled) } : {}),
        ...(patch.recommendationMode !== undefined ? { recommendationMode: normalizeRecommendationMode(patch.recommendationMode) } : {}),
        ...(patch.notificationFrequency !== undefined ? { notificationFrequency: normalizeNotificationFrequency(patch.notificationFrequency) } : {}),
      },
    });
    res.json(fromDbSettings(settings));
  } catch (error) {
    next(error);
  }
});

async function getOrCreateSettings(userId) {
  return prisma.userSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

function normalizeDailyTarget(value) {
  const target = Number(value || 3);
  if (!Number.isFinite(target)) return 3;
  return Math.min(10, Math.max(1, Math.round(target)));
}

function normalizeRecommendationMode(value) {
  return ["smart", "manual"].includes(value) ? value : "smart";
}

function normalizeNotificationFrequency(value) {
  return ["light", "balanced", "frequent"].includes(value) ? value : "balanced";
}

function fromDbSettings(settings) {
  return {
    dailyReviewTarget: settings.dailyReviewTarget,
    autoOpenReviewAfterShare: settings.autoOpenReviewAfterShare,
    storageMode: settings.storageMode,
    backendReady: settings.backendReady,
    smartNotificationsEnabled: settings.smartNotificationsEnabled,
    clipboardSuggestionsEnabled: settings.clipboardSuggestionsEnabled,
    guardinhoActionsEnabled: settings.guardinhoActionsEnabled,
    recommendationMode: settings.recommendationMode,
    notificationFrequency: settings.notificationFrequency,
  };
}

export default router;
