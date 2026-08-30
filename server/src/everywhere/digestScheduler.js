import { buildWeeklyDigest } from "./digestService.js";
import { sendPushToUser } from "../push/webPush.js";

const SIX_DAYS = 6 * 86_400_000;

export function startDigestScheduler(prisma) {
  if (String(process.env.DIGEST_SCHEDULER_ENABLED || "true").toLowerCase() === "false") return null;
  const run = () => dispatchWeeklyDigests(prisma).catch(error => console.error("Digest scheduler:", error));
  const warmup = setTimeout(run, 75_000);
  const interval = setInterval(run, 6 * 60 * 60 * 1000);
  warmup.unref?.(); interval.unref?.();
  return interval;
}

export async function dispatchWeeklyDigests(prisma, { force = false } = {}) {
  const rows = await prisma.userSettings.findMany({ where: { weeklyDigestEnabled: true }, select: { userId: true, lastWeeklyDigestAt: true, user: { select: { pushSubscriptions: { select: { id: true } } } } } });
  let generated = 0; let sent = 0;
  for (const row of rows) {
    if (!force && row.lastWeeklyDigestAt && Date.now() - new Date(row.lastWeeklyDigestAt).getTime() < SIX_DAYS) continue;
    const digest = await buildWeeklyDigest(prisma, row.userId);
    generated += 1;
    if (row.user.pushSubscriptions.length) {
      const delivery = await sendPushToUser(row.userId, { type: "weekly-digest", title: "Sua semana no Guardei", body: digest.summary.slice(0, 180), icon: "/icons/guardei-icon.png", badge: "/icons/guardei-icon-transparent.png", tag: `guardei-digest-${digest.weekKey}`, appUrl: "/?digest=weekly" });
      sent += delivery.sent;
    }
    await prisma.userSettings.update({ where: { userId: row.userId }, data: { lastWeeklyDigestAt: new Date() } });
  }
  return { generated, sent };
}
