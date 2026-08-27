import webpush from "web-push";
import { prisma } from "../db/prisma.js";

let configured = false;

export function getPushConfig() {
  const publicKey = String(process.env.VAPID_PUBLIC_KEY || "").trim();
  const privateKey = String(process.env.VAPID_PRIVATE_KEY || "").trim();
  const subject = String(process.env.VAPID_SUBJECT || "").trim();
  const enabled = Boolean(publicKey && privateKey && subject);

  if (enabled && !configured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }

  return { enabled, publicKey };
}

export async function sendPushToSubscription(subscription, payload) {
  if (!getPushConfig().enabled) return { ok: false, reason: "not-configured" };

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 12, urgency: "normal" }
    );
    return { ok: true };
  } catch (error) {
    const statusCode = Number(error?.statusCode || 0);
    if (statusCode === 404 || statusCode === 410) {
      await prisma.pushSubscription.deleteMany({ where: { endpoint: subscription.endpoint } });
      return { ok: false, reason: "expired" };
    }
    console.error("Erro ao enviar Web Push:", statusCode || error?.message || error);
    return { ok: false, reason: "delivery-failed" };
  }
}

export async function sendPushToUser(userId, payload) {
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (!subscriptions.length) return { sent: 0, failed: 0 };

  const results = await Promise.all(subscriptions.map(subscription => sendPushToSubscription(subscription, payload)));
  return {
    sent: results.filter(result => result.ok).length,
    failed: results.filter(result => !result.ok).length,
  };
}

export async function dispatchSmartPushes({ force = false } = {}) {
  if (!getPushConfig().enabled) return { ok: false, reason: "not-configured", users: 0, sent: 0 };

  const settingsRows = await prisma.userSettings.findMany({
    where: { smartNotificationsEnabled: true },
    select: {
      userId: true,
      notificationFrequency: true,
      lastSmartPushAt: true,
      user: {
        select: {
          pushSubscriptions: { select: { id: true } },
          videos: {
            where: { status: { notIn: ["arquivado", "aplicado"] } },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  let users = 0;
  let sent = 0;

  for (const settings of settingsRows) {
    if (!settings.user.pushSubscriptions.length) continue;
    if (!force && !isPushDue(settings.lastSmartPushAt, settings.notificationFrequency)) continue;

    const candidate = pickCandidate(settings.user.videos);
    if (!candidate) continue;

    const payload = buildPayload(candidate);
    const delivery = await sendPushToUser(settings.userId, payload);
    if (!delivery.sent) continue;

    users += 1;
    sent += delivery.sent;
    await prisma.userSettings.update({
      where: { userId: settings.userId },
      data: { lastSmartPushAt: new Date() },
    });
  }

  return { ok: true, users, sent };
}

export function startPushScheduler() {
  if (String(process.env.PUSH_SCHEDULER_ENABLED || "true").toLowerCase() === "false") return null;

  const intervalMinutes = clampNumber(process.env.PUSH_SCHEDULER_INTERVAL_MINUTES, 60, 15, 360);
  const run = () => dispatchSmartPushes().catch(error => console.error("Push scheduler:", error));
  const warmup = setTimeout(run, 45_000);
  const interval = setInterval(run, intervalMinutes * 60_000);
  warmup.unref?.();
  interval.unref?.();
  return interval;
}

function isPushDue(lastSmartPushAt, frequency) {
  if (!lastSmartPushAt) return true;
  const hours = frequency === "frequent" ? 12 : frequency === "light" ? 72 : 24;
  return Date.now() - new Date(lastSmartPushAt).getTime() >= hours * 60 * 60 * 1000;
}

function pickCandidate(videos = []) {
  const now = Date.now();
  return videos
    .map(video => {
      const reference = new Date(video.reviewedAt || video.createdAt || 0).getTime();
      const ageDays = Number.isFinite(reference) ? Math.max(0, (now - reference) / 86_400_000) : 0;
      let score = Math.min(20, ageDays * 0.55);
      score += { alta: 12, media: 6, baixa: 2 }[video.priority] || 2;
      score += { importante: 14, rever: 9, novo: 5, inbox: 3 }[video.status] || 1;
      score -= Math.min(7, Number(video.reviewCount || 0) * 1.3);
      return { video, ageDays, score };
    })
    .filter(item => item.ageDays >= 7)
    .sort((a, b) => b.score - a.score)[0] || null;
}

function buildPayload(candidate) {
  const { video, ageDays } = candidate;
  const days = Math.max(7, Math.floor(ageDays));
  const title = truncate(video.titleCustom || video.titleAi || video.titleOriginal || "esse link", 62);

  let notificationTitle = "👀 Uma semana depois…";
  let body = `Você salvou “${title}” e nunca mais voltou. O Guardinho trouxe de volta antes de virar fóssil digital.`;

  if (video.status === "importante" || video.priority === "alta") {
    notificationTitle = "⭐ Importante, lembra?";
    body = `“${title}” está há ${days} dias esperando o tratamento VIP que você prometeu.`;
  } else if (days >= 45) {
    notificationTitle = "🗿 Achado arqueológico";
    body = `“${title}” está guardado há ${days} dias. Isso é acervo ou sítio histórico?`;
  } else if (days >= 21) {
    notificationTitle = "🫣 A gente precisa falar sobre isso";
    body = `Faz ${days} dias que você salvou “${title}”. Eu finjo que não vi ou você abre?`;
  }

  return {
    type: "smart-reminder",
    title: notificationTitle,
    body,
    icon: "/icons/guardei-icon.png",
    badge: "/icons/guardei-icon-transparent.png",
    tag: `guardei-push-${video.id}`,
    videoId: video.id,
    url: video.url,
    appUrl: `/?smart-nudge=${encodeURIComponent(video.id)}`,
    actions: [
      { action: "open-link", title: "Abrir link" },
      { action: "seen", title: "Já vi" },
    ],
  };
}

function truncate(value, maxLength) {
  const text = String(value || "").trim();
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trim()}…`;
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}
