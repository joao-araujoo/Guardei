const DAY = 86_400_000;

export async function buildWeeklyDigest(prisma, userId, now = new Date()) {
  const since = new Date(now.getTime() - 7 * DAY);
  const staleBefore = new Date(now.getTime() - 35 * DAY);
  const [recent, consumed, stale] = await Promise.all([
    prisma.video.findMany({ where: { userId, createdAt: { gte: since } }, orderBy: [{ priority: "desc" }, { createdAt: "desc" }], take: 60 }),
    prisma.video.findMany({ where: { userId, consumedAt: { gte: since } }, orderBy: { consumedAt: "desc" }, take: 60 }),
    prisma.video.findMany({ where: { userId, createdAt: { lte: staleBefore }, status: { in: ["novo", "inbox", "rever"] } }, orderBy: { createdAt: "asc" }, take: 30 }),
  ]);

  const important = recent.filter(item => item.priority === "alta" || item.status === "importante").slice(0, 4);
  const highlights = (important.length ? important : recent.slice(0, 4)).map(compact);
  const cleanup = stale.filter(item => item.priority !== "alta" && item.status !== "importante").slice(0, 5).map(compact);
  const resurfaced = stale.filter(item => item.priority === "alta" || item.status === "rever").slice(0, 3).map(compact);
  const categoryCounts = new Map();
  for (const item of recent) categoryCounts.set(item.category, (categoryCounts.get(item.category) || 0) + 1);
  const topCategory = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const summary = [
    `Voce guardou ${recent.length} ${recent.length === 1 ? "coisa" : "coisas"} nesta semana.`,
    consumed.length ? `${consumed.length} sairam do depois e foram consumidas.` : "Nada foi marcado como consumido ainda — sem culpa, so um sinal para simplificar a fila.",
    topCategory ? `O assunto que mais apareceu foi ${topCategory[0]} (${topCategory[1]} itens).` : "Seu acervo ficou mais quieto esta semana.",
    cleanup.length ? `${cleanup.length} itens antigos parecem bons candidatos para uma limpeza rapida.` : "Nao encontrei muita poeira digital para limpar agora.",
  ].join(" ");

  const weekKey = weekKeyFor(now);
  const digest = await prisma.weeklyDigest.upsert({
    where: { userId_weekKey: { userId, weekKey } },
    create: { userId, weekKey, summary, highlights, cleanup, resurfaced },
    update: { summary, highlights, cleanup, resurfaced },
  });
  return { ...digest, highlights, cleanup, resurfaced };
}

export function weekKeyFor(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / DAY) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function compact(video) {
  return { id: video.id, title: video.titleCustom || video.titleAi || video.titleOriginal || "Item salvo", url: video.url, category: video.category, priority: video.priority, status: video.status, savedFor: video.savedFor };
}
