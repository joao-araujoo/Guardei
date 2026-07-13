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
