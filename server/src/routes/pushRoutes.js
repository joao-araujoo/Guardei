import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../db/prisma.js";
import { dispatchSmartPushes, getPushConfig, sendPushToUser } from "../push/webPush.js";

const router = express.Router();

router.post("/cron", async (req, res, next) => {
  try {
    const expected = String(process.env.PUSH_CRON_SECRET || "").trim();
    const received = String(req.get("x-push-cron-secret") || "").trim();
    if (!expected || !received || received !== expected) {
      return res.status(401).json({ ok: false, message: "Cron nao autorizado." });
    }
    const result = await dispatchSmartPushes();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.use(requireAuth);

router.get("/public-key", (_req, res) => {
  const config = getPushConfig();
  res.json({ enabled: config.enabled, publicKey: config.enabled ? config.publicKey : null });
});

router.get("/status", async (req, res, next) => {
  try {
    const [count, settings] = await Promise.all([
      prisma.pushSubscription.count({ where: { userId: req.user.id } }),
      prisma.userSettings.findUnique({ where: { userId: req.user.id } }),
    ]);
    res.json({
      configured: getPushConfig().enabled,
      subscribed: count > 0,
      devices: count,
      smartNotificationsEnabled: Boolean(settings?.smartNotificationsEnabled),
      lastSmartPushAt: settings?.lastSmartPushAt || null,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/subscribe", async (req, res, next) => {
  try {
    if (!getPushConfig().enabled) {
      return res.status(503).json({ ok: false, message: "Web Push ainda nao foi configurado no servidor." });
    }

    const subscription = normalizeSubscription(req.body?.subscription || req.body);
    if (!subscription) return res.status(400).json({ ok: false, message: "Push subscription invalida." });

    const saved = await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        userId: req.user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: String(req.body?.userAgent || req.get("user-agent") || "").slice(0, 500) || null,
        lastSeenAt: new Date(),
      },
      update: {
        userId: req.user.id,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: String(req.body?.userAgent || req.get("user-agent") || "").slice(0, 500) || null,
        lastSeenAt: new Date(),
      },
    });

    await prisma.userSettings.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id, smartNotificationsEnabled: true },
      update: { smartNotificationsEnabled: true },
    });

    res.status(201).json({ ok: true, id: saved.id });
  } catch (error) {
    next(error);
  }
});

router.delete("/subscribe", async (req, res, next) => {
  try {
    const endpoint = String(req.body?.endpoint || "").trim();
    if (!endpoint) return res.status(400).json({ ok: false, message: "Endpoint obrigatorio." });

    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.user.id } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/test", async (req, res, next) => {
  try {
    if (!getPushConfig().enabled) {
      return res.status(503).json({ ok: false, message: "Web Push ainda nao foi configurado no servidor." });
    }

    const delivery = await sendPushToUser(req.user.id, {
      type: "test",
      title: "🛎️ Guardinho na área",
      body: "Push funcionando. Agora eu consigo te lembrar dos links mesmo com o Guardei fechado.",
      icon: "/icons/guardei-icon.png",
      badge: "/icons/guardei-icon-transparent.png",
      tag: "guardei-push-test",
      appUrl: "/",
      actions: [{ action: "open-app", title: "Abrir Guardei" }],
    });

    if (!delivery.sent) return res.status(404).json({ ok: false, message: "Nenhum dispositivo inscrito para push." });
    res.json({ ok: true, ...delivery });
  } catch (error) {
    next(error);
  }
});

function normalizeSubscription(value) {
  const endpoint = String(value?.endpoint || "").trim();
  const p256dh = String(value?.keys?.p256dh || "").trim();
  const auth = String(value?.keys?.auth || "").trim();
  if (!endpoint || !p256dh || !auth || !/^https:\/\//i.test(endpoint)) return null;
  return { endpoint, keys: { p256dh, auth } };
}

export default router;
