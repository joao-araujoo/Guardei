import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../db/prisma.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const achievements = await prisma.userAchievement.findMany({
      where: { userId: req.user.id },
      orderBy: { unlockedAt: "desc" },
    });
    res.json(achievements.map(fromDbAchievement));
  } catch (error) {
    next(error);
  }
});

router.post("/sync", async (req, res, next) => {
  try {
    const achievementIds = Array.isArray(req.body?.achievementIds) ? req.body.achievementIds : [];
    const cleanIds = [...new Set(achievementIds.map((id) => String(id || "").trim()).filter(Boolean))];

    for (const achievementId of cleanIds) {
      await prisma.userAchievement.upsert({
        where: { userId_achievementId: { userId: req.user.id, achievementId } },
        update: {},
        create: { userId: req.user.id, achievementId },
      });
    }

    const achievements = await prisma.userAchievement.findMany({
      where: { userId: req.user.id },
      orderBy: { unlockedAt: "desc" },
    });
    res.json(achievements.map(fromDbAchievement));
  } catch (error) {
    next(error);
  }
});

function fromDbAchievement(achievement) {
  return {
    id: achievement.id,
    achievementId: achievement.achievementId,
    unlockedAt: achievement.unlockedAt?.toISOString?.() || achievement.unlockedAt,
  };
}

export default router;
