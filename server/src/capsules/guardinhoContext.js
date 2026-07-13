import { hybridSearch } from "../search/searchService.js";

export async function selectRelevantKnowledge(prisma, userId, message, limit = 12) {
  const search = await hybridSearch({ prisma, userId, params: { q: message, limit: Math.min(16, limit), mode: "hybrid" } });
  return search.results.map(({ item, score, reasons }) => ({
    id: item.id,
    title: item.titleCustom || item.titleAi || item.titleOriginal || "Sem titulo",
    category: item.category,
    tags: (item.tags || []).slice(0, 6),
    status: item.status,
    mood: item.mood,
    durationBucket: item.durationBucket,
    relevanceScore: score,
    matchReasons: reasons,
    capsule: item.capsule ? {
      summary: item.capsule.summary,
      keyPoints: asArray(item.capsule.keyPoints).slice(0, 4),
      concepts: asArray(item.capsule.concepts).slice(0, 5),
      actionItems: asArray(item.capsule.actionItems).slice(0, 3),
      coverage: item.capsule.coverage,
      status: item.capsule.status,
    } : null,
  }));
}

export async function selectRelevantPaths(prisma, userId, message, limit = 4) {
  const tokens = normalize(message).split(/\s+/).filter((token) => token.length >= 3).slice(0, 12);
  const paths = await prisma.learningPath.findMany({
    where: { userId, status: { not: "archived" } },
    orderBy: { updatedAt: "desc" },
    take: 20,
    include: { items: { orderBy: { position: "asc" }, take: 8, include: { video: { select: { id: true, titleCustom: true, titleAi: true, titleOriginal: true } } } }, gaps: { where: { status: "open" }, take: 5 } },
  });
  return paths.map((path) => {
    const haystack = normalize(`${path.title} ${path.objective} ${path.description || ""} ${path.categories.join(" ")}`);
    const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
    return { path, score };
  }).filter(({ score }) => score > 0 || /trilha|objetivo|falta/.test(normalize(message)))
    .sort((a, b) => b.score - a.score || new Date(b.path.updatedAt) - new Date(a.path.updatedAt))
    .slice(0, limit)
    .map(({ path }) => ({
      id: path.id,
      title: path.title,
      objective: path.objective,
      progress: path.progress,
      items: path.items.map((item) => ({ id: item.video.id, title: item.video.titleCustom || item.video.titleAi || item.video.titleOriginal, status: item.status, section: item.section })),
      gaps: path.gaps.map((gap) => ({ title: gap.title, description: gap.description, importance: gap.importance })),
    }));
}

function asArray(value) { return Array.isArray(value) ? value : []; }
function normalize(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }

export async function selectKnowledgeCycleContext(prisma, userId, { message = "", videoIds = [], pathIds = [] } = {}) {
  const relevantVideoIds = [...new Set(videoIds.filter(Boolean))].slice(0, 12);
  const relevantPathIds = [...new Set(pathIds.filter(Boolean))].slice(0, 4);
  const normalized = normalize(message);
  const wantsReview = /revis|lembr|esquec|pergunta|record/.test(normalized);
  const wantsApplication = /aplic|pratica|implementar|fazer/.test(normalized);
  const videoFilter = relevantVideoIds.length ? { videoId: { in: relevantVideoIds } } : {};

  const [reflections, cards, applications] = await Promise.all([
    prisma.contentReflection.findMany({
      where: { userId, ...videoFilter },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: { video: { select: { id: true, titleCustom: true, titleAi: true, titleOriginal: true } } },
    }),
    prisma.knowledgeCard.findMany({
      where: {
        userId,
        ...(wantsReview
          ? { status: "active", OR: relevantVideoIds.length ? [{ videoId: { in: relevantVideoIds } }, { nextReviewAt: { lte: new Date() } }] : [{ nextReviewAt: { lte: new Date() } }] }
          : videoFilter),
      },
      orderBy: [{ nextReviewAt: "asc" }, { updatedAt: "desc" }],
      take: 10,
      include: {
        video: { select: { id: true, titleCustom: true, titleAi: true, titleOriginal: true, category: true } },
        attempts: { orderBy: { reviewedAt: "desc" }, take: 3, select: { rating: true, reviewedAt: true, previousInterval: true, nextInterval: true } },
      },
    }),
    prisma.applicationCommitment.findMany({
      where: {
        userId,
        ...(wantsApplication
          ? { OR: [
              ...(relevantVideoIds.length ? [{ videoId: { in: relevantVideoIds } }] : []),
              ...(relevantPathIds.length ? [{ learningPathId: { in: relevantPathIds } }] : []),
              { status: { in: ["planned", "in_progress"] } },
            ] }
          : { ...videoFilter, ...(relevantPathIds.length ? { learningPathId: { in: relevantPathIds } } : {}) }),
      },
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
      take: 10,
      include: { video: { select: { id: true, titleCustom: true, titleAi: true, titleOriginal: true } }, learningPath: { select: { id: true, title: true } } },
    }),
  ]);

  const safeReflections = reflections.map((item) => ({
    videoId: item.videoId,
    title: titleOf(item.video),
    mainLearning: clip(item.mainLearning, 500),
    rememberLater: clip(item.rememberLater, 500),
    applicationIdea: clip(item.applicationIdea, 500),
    confidence: item.confidence,
  }));
  const safeCards = cards.map((card) => ({
    id: card.id,
    videoId: card.videoId,
    title: titleOf(card.video),
    category: card.video?.category,
    question: clip(card.question, 400),
    answer: clip(card.answer, 600),
    status: card.status,
    nextReviewAt: card.nextReviewAt?.toISOString?.() || card.nextReviewAt,
    lastRatings: card.attempts.map((attempt) => ({ rating: attempt.rating, reviewedAt: attempt.reviewedAt?.toISOString?.() || attempt.reviewedAt })),
  }));
  const safeApplications = applications.map((item) => ({
    id: item.id,
    title: clip(item.title, 180),
    description: clip(item.description, 500),
    status: item.status,
    dueAt: item.dueAt?.toISOString?.() || item.dueAt,
    completedAt: item.completedAt?.toISOString?.() || item.completedAt,
    evidenceRecorded: Boolean(item.evidenceText || item.evidenceUrl || item.reflection),
    videoTitle: titleOf(item.video),
    pathTitle: item.learningPath?.title || null,
  }));

  return {
    reflections: safeReflections,
    cards: safeCards,
    applications: safeApplications,
    facts: {
      dueCards: safeCards.filter((card) => card.status === "active" && card.nextReviewAt && new Date(card.nextReviewAt) <= new Date()).length,
      difficultCards: safeCards.filter((card) => card.lastRatings.some((attempt) => ["again", "hard"].includes(attempt.rating))).length,
      pendingApplications: safeApplications.filter((item) => ["planned", "in_progress"].includes(item.status)).length,
      completedApplications: safeApplications.filter((item) => item.status === "completed").length,
    },
  };
}

function titleOf(video) { return video?.titleCustom || video?.titleAi || video?.titleOriginal || "Conteudo salvo"; }
function clip(value, max) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, max) || null; }
