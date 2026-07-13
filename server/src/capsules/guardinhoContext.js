export async function selectRelevantKnowledge(prisma, userId, message, limit = 12) {
  const items = await prisma.video.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 80,
    select: {
      id: true,
      titleCustom: true,
      titleAi: true,
      titleOriginal: true,
      category: true,
      tags: true,
      status: true,
      mood: true,
      durationBucket: true,
      createdAt: true,
      capsule: {
        select: {
          summary: true,
          keyPoints: true,
          concepts: true,
          actionItems: true,
          coverage: true,
          status: true,
          generatedAt: true,
        },
      },
    },
  });

  const tokens = tokenize(message);
  return items
    .map((item) => ({ item, score: scoreItem(item, tokens) }))
    .filter(({ score, item }) => score > 0 || !tokens.length || item.capsule)
    .sort((a, b) => b.score - a.score || new Date(b.item.createdAt) - new Date(a.item.createdAt))
    .slice(0, limit)
    .map(({ item }) => ({
      id: item.id,
      title: item.titleCustom || item.titleAi || item.titleOriginal || "Sem titulo",
      category: item.category,
      tags: item.tags?.slice(0, 6) || [],
      status: item.status,
      mood: item.mood,
      durationBucket: item.durationBucket,
      createdAt: item.createdAt,
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

function scoreItem(item, tokens) {
  const title = item.titleCustom || item.titleAi || item.titleOriginal || "";
  const capsule = item.capsule || {};
  const haystack = normalize([
    title,
    item.category,
    ...(item.tags || []),
    capsule.summary,
    ...asArray(capsule.keyPoints),
    ...asArray(capsule.concepts),
  ].filter(Boolean).join(" "));
  let score = item.capsule ? 4 : 0;
  for (const token of tokens) {
    if (normalize(title).includes(token)) score += 8;
    else if (haystack.includes(token)) score += 3;
  }
  if (["completed", "limited"].includes(capsule.status)) score += 2;
  return score;
}

function tokenize(value) {
  return [...new Set(normalize(value).split(/\s+/).filter((token) => token.length >= 3))].slice(0, 12);
}

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}
