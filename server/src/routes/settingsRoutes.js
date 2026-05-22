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
      },
      update: {
        ...(patch.dailyReviewTarget !== undefined ? { dailyReviewTarget: normalizeDailyTarget(patch.dailyReviewTarget) } : {}),
        ...(patch.autoOpenReviewAfterShare !== undefined ? { autoOpenReviewAfterShare: Boolean(patch.autoOpenReviewAfterShare) } : {}),
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

function fromDbSettings(settings) {
  return {
    dailyReviewTarget: settings.dailyReviewTarget,
    autoOpenReviewAfterShare: settings.autoOpenReviewAfterShare,
    storageMode: settings.storageMode,
    backendReady: settings.backendReady,
  };
}

export default router;
