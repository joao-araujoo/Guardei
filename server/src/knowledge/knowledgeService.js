export async function getKnowledgeDashboard({ prisma, userId, days = 30, now = new Date() }) {
  const safeDays = Math.min(365, Math.max(7, Number(days) || 30));
  const start = new Date(now.getTime() - (safeDays - 1) * 86_400_000);
  start.setHours(0, 0, 0, 0);
  const [videos, reflections, cards, attempts, applications, paths] = await Promise.all([
    prisma.video.findMany({ where: { userId }, select: { id: true, category: true, tags: true, consumedAt: true, watchedAt: true, appliedAt: true, applicationStatus: true, createdAt: true } }),
    prisma.contentReflection.findMany({ where: { userId }, select: { id: true, videoId: true, confidence: true, createdAt: true } }),
    prisma.knowledgeCard.findMany({ where: { userId }, select: { id: true, status: true, nextReviewAt: true, videoId: true, video: { select: { category: true, tags: true } } } }),
    prisma.reviewAttempt.findMany({ where: { userId }, orderBy: { reviewedAt: "asc" }, include: { knowledgeCard: { select: { id: true, video: { select: { category: true, tags: true } } } } } }),
    prisma.applicationCommitment.findMany({ where: { userId }, select: { id: true, status: true, completedAt: true, createdAt: true, videoId: true, learningPathId: true } }),
    prisma.learningPath.findMany({ where: { userId, status: "completed" }, select: { id: true } }),
  ]);

  const rememberedAttempts = attempts.filter((attempt) => ["good", "easy"].includes(attempt.rating));
  const recallRate = attempts.length ? rememberedAttempts.length / attempts.length : null;
  const confidenceValues = reflections.map((item) => item.confidence).filter(Number.isFinite);
  const dueCards = cards.filter((card) => card.status === "active" && new Date(card.nextReviewAt) <= now);
  const realApplications = videos.filter((video) => video.applicationStatus === "completed" && video.appliedAt);
  const legacyApplications = videos.filter((video) => video.applicationStatus === "legacy_applied");
  const consumedVideos = videos.filter((video) => video.consumedAt || video.watchedAt);
  const topicStats = buildTopicStats(attempts);
  const trend = buildTrend({ attempts, applications, videos, start, days: safeDays });
  const streakDays = calculateReviewStreak(attempts, now);
  const recoveredCount = countRecoveredCards(attempts);
  const completedPathIds = new Set(paths.map((path) => path.id));
  const completedPathsWithApplications = new Set(applications.filter((item) => item.status === "completed" && item.learningPathId && completedPathIds.has(item.learningPathId)).map((item) => item.learningPathId)).size;

  const metrics = {
    cardsReviewed: attempts.length,
    cardsPending: dueCards.length,
    activeCards: cards.filter((card) => card.status === "active").length,
    recallRate,
    recallAttempts: attempts.length,
    averageConfidence: confidenceValues.length ? average(confidenceValues) : null,
    confidenceSamples: confidenceValues.length,
    applicationsPlanned: applications.filter((item) => ["planned", "in_progress"].includes(item.status)).length,
    applicationsCompleted: applications.filter((item) => item.status === "completed").length,
    contentsConsumed: consumedVideos.length,
    contentsApplied: realApplications.length,
    legacyApplied: legacyApplications.length,
    reflectionCount: reflections.length,
    reviewAttemptCount: attempts.length,
    rememberedCount: rememberedAttempts.length,
    reviewStreakDays: streakDays,
    recoveredCount,
    completedPathsWithApplications,
  };

  return {
    generatedAt: now.toISOString(),
    periodDays: safeDays,
    metrics,
    difficultTopics: topicStats.filter((item) => item.attempts >= 1).sort((a, b) => a.recallRate - b.recallRate || b.attempts - a.attempts).slice(0, 6),
    bestRetentionTopics: topicStats.filter((item) => item.attempts >= 2).sort((a, b) => b.recallRate - a.recallRate || b.attempts - a.attempts).slice(0, 6),
    trend,
    summary: buildSummary(metrics, topicStats),
  };
}

function buildTopicStats(attempts) {
  const map = new Map();
  for (const attempt of attempts) {
    const category = attempt.knowledgeCard?.video?.category || "misc";
    const current = map.get(category) || { topic: category, attempts: 0, remembered: 0, again: 0 };
    current.attempts += 1;
    if (["good", "easy"].includes(attempt.rating)) current.remembered += 1;
    if (attempt.rating === "again") current.again += 1;
    map.set(category, current);
  }
  return [...map.values()].map((item) => ({ ...item, recallRate: item.attempts ? item.remembered / item.attempts : null }));
}

function buildTrend({ attempts, applications, videos, start, days }) {
  const rows = Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getTime() + index * 86_400_000);
    return { date: date.toISOString().slice(0, 10), reviews: 0, remembered: 0, applications: 0, consumed: 0 };
  });
  const byDate = new Map(rows.map((row) => [row.date, row]));
  attempts.forEach((attempt) => {
    const row = byDate.get(dayKey(attempt.reviewedAt));
    if (!row) return;
    row.reviews += 1;
    if (["good", "easy"].includes(attempt.rating)) row.remembered += 1;
  });
  applications.filter((item) => item.status === "completed" && item.completedAt).forEach((item) => {
    const row = byDate.get(dayKey(item.completedAt));
    if (row) row.applications += 1;
  });
  videos.filter((item) => item.consumedAt || item.watchedAt).forEach((item) => {
    const row = byDate.get(dayKey(item.consumedAt || item.watchedAt));
    if (row) row.consumed += 1;
  });
  return rows;
}

export function calculateReviewStreak(attempts, now = new Date()) {
  const days = new Set(attempts.map((attempt) => dayKey(attempt.reviewedAt)));
  if (!days.size) return 0;
  let cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  if (!days.has(dayKey(cursor))) cursor = new Date(cursor.getTime() - 86_400_000);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }
  return streak;
}

export function countRecoveredCards(attempts) {
  const byCard = new Map();
  attempts.forEach((attempt) => {
    const cardId = attempt.knowledgeCardId || attempt.knowledgeCard?.id;
    if (!cardId) return;
    if (!byCard.has(cardId)) byCard.set(cardId, []);
    byCard.get(cardId).push(attempt);
  });
  let recovered = 0;
  byCard.forEach((items) => {
    let forgot = false;
    for (const item of items.sort((a, b) => new Date(a.reviewedAt) - new Date(b.reviewedAt))) {
      if (item.rating === "again") forgot = true;
      if (forgot && ["good", "easy"].includes(item.rating)) { recovered += 1; break; }
    }
  });
  return recovered;
}

function buildSummary(metrics, topics) {
  const parts = [];
  if (!metrics.recallAttempts) parts.push("Ainda nao ha tentativas suficientes para calcular retencao.");
  else parts.push(`Voce lembrou ${Math.round(metrics.recallRate * 100)}% das ${metrics.recallAttempts} revisoes registradas.`);
  if (metrics.cardsPending) parts.push(`${metrics.cardsPending} cartoes estao prontos para revisar.`);
  if (metrics.applicationsPlanned) parts.push(`${metrics.applicationsPlanned} aplicacoes ainda estao em andamento ou planejadas.`);
  if (metrics.legacyApplied) parts.push(`${metrics.legacyApplied} itens antigos permanecem marcados como aplicados sem evidencia nova e nao entram na metrica de aplicacao real.`);
  const hardest = topics.filter((item) => item.attempts >= 2).sort((a, b) => a.recallRate - b.recallRate)[0];
  if (hardest) parts.push(`O assunto com maior dificuldade registrada e ${hardest.topic}.`);
  return parts;
}
function dayKey(value) { const date = value instanceof Date ? value : new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10); }
function average(values) { return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100; }
