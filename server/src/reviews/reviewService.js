import { scheduleNextReview } from "./scheduler.js";

export async function recordReviewAttempt({ prisma, userId, cardId, payload, now = new Date() }) {
  const card = await prisma.knowledgeCard.findFirst({
    where: { id: cardId, userId },
    include: { video: { select: videoSelect } },
  });
  if (!card) return { notFound: true };
  if (card.status !== "active") return { conflict: true, code: "CARD_SUSPENDED", message: "Reative o cartao antes de revisa-lo." };

  const reflection = await prisma.contentReflection.findFirst({ where: { userId, videoId: card.videoId }, select: { confidence: true } });
  const schedule = scheduleNextReview(card, payload.rating, {
    now,
    previousDueAt: card.nextReviewAt,
    confidence: reflection?.confidence || 3,
  });

  const execute = async (tx) => {
    const attempt = await tx.reviewAttempt.create({
      data: {
        userId,
        knowledgeCardId: card.id,
        answerText: payload.answerText,
        rating: payload.rating,
        previousInterval: schedule.previousInterval,
        nextInterval: schedule.intervalDays,
        easeFactorAfter: schedule.easeFactor,
        reviewedAt: now,
      },
    });
    const updated = await tx.knowledgeCard.update({
      where: { id: card.id },
      data: {
        intervalDays: schedule.intervalDays,
        repetitions: schedule.repetitions,
        easeFactor: schedule.easeFactor,
        nextReviewAt: schedule.nextReviewAt,
        lastReviewedAt: now,
      },
      include: { video: { select: videoSelect } },
    });
    return { attempt, card: updated };
  };
  const result = typeof prisma.$transaction === "function" ? await prisma.$transaction(execute) : await execute(prisma);
  return {
    card: serializeCard(result.card),
    attempt: serializeAttempt(result.attempt),
    schedule: {
      previousInterval: schedule.previousInterval,
      nextInterval: schedule.intervalDays,
      nextReviewAt: schedule.nextReviewAt.toISOString(),
      easeFactor: schedule.easeFactor,
      overdueDays: schedule.overdueDays,
    },
  };
}

export async function getTodayHub({ prisma, userId, now = new Date() }) {
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const soon = new Date(endOfDay.getTime() + 3 * 86_400_000);
  const [decisionItems, dueCards, applications, paths] = await Promise.all([
    prisma.video.findMany({
      where: { userId, status: "inbox" },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: 20,
      select: videoSelect,
    }),
    prisma.knowledgeCard.findMany({
      where: { userId, status: "active", nextReviewAt: { lte: now } },
      orderBy: [{ nextReviewAt: "asc" }, { createdAt: "asc" }],
      take: 50,
      include: { video: { select: videoSelect } },
    }),
    prisma.applicationCommitment.findMany({
      where: { userId, status: { in: ["planned", "in_progress"] }, OR: [{ dueAt: null }, { dueAt: { lte: soon } }] },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
      take: 20,
      include: { video: { select: videoSelect }, learningPath: { select: { id: true, title: true } } },
    }),
    prisma.learningPath.findMany({
      where: { userId, status: "active" },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: {
        items: {
          where: { status: { in: ["pending", "in_progress"] } },
          orderBy: { position: "asc" },
          take: 1,
          include: { video: { select: videoSelect } },
        },
      },
    }),
  ]);

  const serializedCards = dueCards.map(serializeCard);
  const serializedApplications = applications.map(serializeApplication);
  const pathActions = paths.filter((path) => path.items[0]).map((path) => ({
    pathId: path.id,
    title: path.title,
    objective: path.objective,
    progress: path.progress,
    nextItem: serializePathItem(path.items[0]),
  }));
  const overdueApplications = serializedApplications.filter((item) => item.dueAt && new Date(item.dueAt) < now);
  const nextAction = chooseNextAction({ dueCards: serializedCards, overdueApplications, applications: serializedApplications, paths: pathActions, decisions: decisionItems });

  return {
    generatedAt: now.toISOString(),
    counts: {
      decisions: decisionItems.length,
      dueCards: serializedCards.length,
      applications: serializedApplications.length,
      overdueApplications: overdueApplications.length,
      activePaths: pathActions.length,
    },
    nextAction,
    decisions: decisionItems.slice(0, 8).map(serializeVideoSummary),
    cards: serializedCards,
    applications: serializedApplications,
    paths: pathActions,
    sessions: {
      two: buildReviewSession({ minutes: 2, cards: serializedCards, applications: serializedApplications, decisions: decisionItems, paths: pathActions }),
      five: buildReviewSession({ minutes: 5, cards: serializedCards, applications: serializedApplications, decisions: decisionItems, paths: pathActions }),
      ten: buildReviewSession({ minutes: 10, cards: serializedCards, applications: serializedApplications, decisions: decisionItems, paths: pathActions }),
      full: buildReviewSession({ minutes: null, cards: serializedCards, applications: serializedApplications, decisions: decisionItems, paths: pathActions }),
    },
  };
}

export function buildReviewSession({ minutes, cards = [], applications = [], decisions = [], paths = [] }) {
  const budgetSeconds = minutes ? minutes * 60 : Number.POSITIVE_INFINITY;
  let spent = 0;
  const activities = [];
  const add = (type, item, seconds) => {
    if (spent + seconds > budgetSeconds && activities.length) return false;
    activities.push({ type, estimatedSeconds: seconds, item });
    spent += seconds;
    return true;
  };
  for (const card of cards) if (!add("card", card, 45)) break;
  for (const application of applications) if (!add("application", application, 90)) break;
  for (const path of paths) if (!add("path", path, 90)) break;
  for (const decision of decisions) if (!add("decision", serializeVideoSummary(decision), 60)) break;
  return { minutes, estimatedSeconds: spent, activities };
}

export function serializeCard(card, { includeAnswer = true } = {}) {
  if (!card) return null;
  const { userId, ...safe } = card;
  return {
    ...safe,
    ...(includeAnswer ? {} : { answer: undefined }),
    nextReviewAt: iso(card.nextReviewAt),
    lastReviewedAt: iso(card.lastReviewedAt),
    createdAt: iso(card.createdAt),
    updatedAt: iso(card.updatedAt),
    video: card.video ? serializeVideoSummary(card.video) : undefined,
  };
}

export function serializeAttempt(attempt) {
  if (!attempt) return null;
  const { userId, answerText, ...safe } = attempt;
  return { ...safe, reviewedAt: iso(attempt.reviewedAt), answerRecorded: Boolean(answerText) };
}

export function serializeApplication(item) {
  if (!item) return null;
  const { userId, ...safe } = item;
  return {
    ...safe,
    dueAt: iso(item.dueAt),
    completedAt: iso(item.completedAt),
    createdAt: iso(item.createdAt),
    updatedAt: iso(item.updatedAt),
    video: item.video ? serializeVideoSummary(item.video) : undefined,
  };
}

export function serializeReflection(item) {
  if (!item) return null;
  const { userId, ...safe } = item;
  return { ...safe, createdAt: iso(item.createdAt), updatedAt: iso(item.updatedAt) };
}

const videoSelect = {
  id: true,
  titleCustom: true,
  titleAi: true,
  titleOriginal: true,
  url: true,
  category: true,
  status: true,
  priority: true,
  thumbnailUrl: true,
  platform: true,
  durationBucket: true,
  consumedAt: true,
  watchedAt: true,
  applicationStatus: true,
};

function serializeVideoSummary(video) {
  return {
    id: video.id,
    title: video.titleCustom || video.titleAi || video.titleOriginal || "Conteudo salvo",
    url: video.url,
    category: video.category,
    status: video.status,
    priority: video.priority,
    thumbnailUrl: video.thumbnailUrl,
    platform: video.platform,
    durationBucket: video.durationBucket,
    consumedAt: iso(video.consumedAt || video.watchedAt),
    applicationStatus: video.applicationStatus,
  };
}
function serializePathItem(item) {
  return { id: item.id, status: item.status, section: item.section, estimatedMinutes: item.estimatedMinutes, video: serializeVideoSummary(item.video) };
}
function chooseNextAction({ dueCards, overdueApplications, applications, paths, decisions }) {
  if (overdueApplications.length) return { type: "application", title: "Uma aplicacao esta atrasada", description: overdueApplications[0].title, targetId: overdueApplications[0].id };
  if (dueCards.length) return { type: "cards", title: `Voce tem ${dueCards.length} ${dueCards.length === 1 ? "cartao" : "cartoes"} para recordar`, description: "Uma sessao curta ajuda a manter o que voce aprendeu acessivel." };
  if (applications.length) return { type: "application", title: "Leve um aprendizado para a pratica", description: applications[0].title, targetId: applications[0].id };
  if (paths.length) return { type: "path", title: `Continue a trilha ${paths[0].title}`, description: paths[0].nextItem.video.title, targetId: paths[0].pathId };
  if (decisions.length) return { type: "decision", title: `Seu inbox possui ${decisions.length} ${decisions.length === 1 ? "item" : "itens"} para decidir`, description: "Classifique, arquive ou escolha o proximo conteudo." };
  return { type: "empty", title: "Seu ciclo esta em dia", description: "Consuma algo quando fizer sentido e registre apenas o que vale lembrar." };
}
function iso(value) { return value?.toISOString?.() || value || null; }
