import { hybridSearch } from "../search/searchService.js";
import { generatePathPlan } from "./pathGenerator.js";
import { serializePath } from "./pathSchema.js";

const PATH_INCLUDE = {
  items: {
    orderBy: { position: "asc" },
    include: {
      video: {
        select: {
          id: true, url: true, titleCustom: true, titleAi: true, titleOriginal: true, thumbnailUrl: true,
          category: true, platform: true, status: true, priority: true, tags: true, durationBucket: true,
          mood: true, effort: true,
          capsule: { select: { id: true, status: true, coverage: true, summary: true } },
        },
      },
    },
  },
  gaps: { orderBy: [{ status: "asc" }, { importance: "desc" }, { createdAt: "asc" }] },
};

export async function findOwnedPath(prisma, userId, pathId) {
  return prisma.learningPath.findFirst({ where: { id: pathId, userId }, include: PATH_INCLUDE });
}

export async function listPaths(prisma, userId) {
  const paths = await prisma.learningPath.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, include: PATH_INCLUDE });
  return paths.map(serializePath);
}

export async function createPath(prisma, userId, input) {
  const created = await prisma.learningPath.create({ data: { userId, ...input }, include: PATH_INCLUDE });
  return serializePath(created);
}

export async function updatePath(prisma, userId, pathId, patch) {
  const result = await prisma.learningPath.updateMany({ where: { id: pathId, userId }, data: patch });
  if (!result.count) return null;
  return serializePath(await findOwnedPath(prisma, userId, pathId));
}

export async function generatePath({ prisma, userId, pathId, reorganize = false, searcher = hybridSearch, planner = generatePathPlan }) {
  const path = await findOwnedPath(prisma, userId, pathId);
  if (!path) return { notFound: true };

  const search = await searcher({
    prisma,
    userId,
    params: { q: `${path.objective} ${path.description || ""}`, limit: 30, category: path.categories?.length === 1 ? path.categories[0] : undefined },
  });
  const candidates = search.results.slice(0, 24);
  const plan = await planner({ path, candidates });
  const manualItems = path.items.filter((item) => item.manualAdded);
  const manualVideoIds = new Set(manualItems.map((item) => item.videoId));
  const generatedItems = plan.items.filter((item) => !manualVideoIds.has(item.videoId));

  await prisma.$transaction(async (tx) => {
    await tx.learningPathItem.deleteMany({ where: { learningPathId: pathId, manualAdded: false } });
    await tx.learningPathGap.deleteMany({ where: { learningPathId: pathId, status: "open" } });
    if (generatedItems.length) {
      await tx.learningPathItem.createMany({ data: generatedItems.map((item, index) => ({
        learningPathId: pathId,
        videoId: item.videoId,
        position: manualItems.length + index,
        section: item.section,
        reason: item.reason,
        estimatedMinutes: item.estimatedMinutes,
        manualAdded: false,
      })), skipDuplicates: true });
    }
    if (plan.gaps.length) await tx.learningPathGap.createMany({ data: plan.gaps.map((gap) => ({ learningPathId: pathId, ...gap })) });
    await tx.learningPath.update({ where: { id: pathId }, data: { aiGenerated: true } });
  });
  await recalculateProgress(prisma, userId, pathId);
  return { path: serializePath(await findOwnedPath(prisma, userId, pathId)), searchMode: search.mode };
}

export async function addPathItem(prisma, userId, pathId, input) {
  const path = await findOwnedPath(prisma, userId, pathId);
  if (!path) return { notFound: true };
  const video = await prisma.video.findFirst({ where: { id: input.videoId, userId }, select: { id: true, durationBucket: true } });
  if (!video) return { videoNotFound: true };
  const maxPosition = path.items.reduce((max, item) => Math.max(max, item.position), -1);
  await prisma.learningPathItem.upsert({
    where: { learningPathId_videoId: { learningPathId: pathId, videoId: video.id } },
    create: {
      learningPathId: pathId,
      videoId: video.id,
      position: maxPosition + 1,
      section: input.section || "Adicionados por voce",
      reason: input.reason || "Adicionado manualmente.",
      estimatedMinutes: input.estimatedMinutes || estimateMinutes(video.durationBucket),
      note: input.note || null,
      manualAdded: true,
    },
    update: { manualAdded: true, section: input.section || undefined, reason: input.reason || undefined, note: input.note || undefined },
  });
  await recalculateProgress(prisma, userId, pathId);
  return { path: serializePath(await findOwnedPath(prisma, userId, pathId)) };
}

export async function updatePathItem(prisma, userId, pathId, itemId, patch) {
  const owned = await prisma.learningPathItem.findFirst({ where: { id: itemId, learningPathId: pathId, learningPath: { is: { userId } } } });
  if (!owned) return null;
  const data = {};
  if (patch.section !== undefined) data.section = clean(patch.section, 120) || owned.section;
  if (patch.reason !== undefined) data.reason = clean(patch.reason, 320);
  if (patch.note !== undefined) data.note = clean(patch.note, 600);
  if (patch.estimatedMinutes !== undefined) data.estimatedMinutes = clampInt(patch.estimatedMinutes, 1, 600, owned.estimatedMinutes);
  if (patch.status !== undefined && ["pending", "in_progress", "completed", "skipped"].includes(patch.status)) {
    data.status = patch.status;
    data.completedAt = patch.status === "completed" ? new Date() : null;
  }
  data.manualAdded = true;
  await prisma.learningPathItem.update({ where: { id: itemId }, data });
  await recalculateProgress(prisma, userId, pathId);
  return serializePath(await findOwnedPath(prisma, userId, pathId));
}

export async function removePathItem(prisma, userId, pathId, itemId) {
  const result = await prisma.learningPathItem.deleteMany({ where: { id: itemId, learningPathId: pathId, learningPath: { is: { userId } } } });
  if (!result.count) return false;
  await normalizePositions(prisma, userId, pathId);
  await recalculateProgress(prisma, userId, pathId);
  return true;
}

export async function reorderPathItems(prisma, userId, pathId, orderedItems = []) {
  const path = await findOwnedPath(prisma, userId, pathId);
  if (!path) return null;
  const ownedIds = new Set(path.items.map((item) => item.id));
  const unique = [];
  for (const entry of orderedItems.slice(0, 60)) {
    const id = typeof entry === "string" ? entry : entry?.id;
    if (!ownedIds.has(id) || unique.some((item) => item.id === id)) continue;
    unique.push({ id, section: clean(entry?.section, 120) || path.items.find((item) => item.id === id)?.section || "Etapa 1" });
  }
  for (const item of path.items) if (!unique.some((entry) => entry.id === item.id)) unique.push({ id: item.id, section: item.section });
  await prisma.$transaction(unique.map((entry, position) => prisma.learningPathItem.update({ where: { id: entry.id }, data: { position, section: entry.section, manualAdded: true } })));
  return serializePath(await findOwnedPath(prisma, userId, pathId));
}

export async function duplicatePath(prisma, userId, pathId) {
  const source = await findOwnedPath(prisma, userId, pathId);
  if (!source) return null;
  const duplicate = await prisma.learningPath.create({
    data: {
      userId,
      title: `${source.title} (copia)`.slice(0, 140), objective: source.objective, description: source.description,
      currentLevel: source.currentLevel, weeklyMinutes: source.weeklyMinutes, deadline: source.deadline,
      categories: source.categories, resultType: source.resultType, autoOrganize: source.autoOrganize, aiGenerated: source.aiGenerated,
      items: { create: source.items.map((item) => ({ videoId: item.videoId, position: item.position, section: item.section, reason: item.reason, estimatedMinutes: item.estimatedMinutes, note: item.note, manualAdded: true })) },
      gaps: { create: source.gaps.filter((gap) => gap.status === "open").map((gap) => ({ title: gap.title, description: gap.description, importance: gap.importance })) },
    },
    include: PATH_INCLUDE,
  });
  return serializePath(duplicate);
}

export async function updateGap(prisma, userId, pathId, gapId, patch) {
  const gap = await prisma.learningPathGap.findFirst({ where: { id: gapId, learningPathId: pathId, learningPath: { is: { userId } } } });
  if (!gap) return null;
  const data = {};
  if (["open", "resolved", "dismissed"].includes(patch.status)) data.status = patch.status;
  if (["low", "medium", "high"].includes(patch.importance)) data.importance = patch.importance;
  await prisma.learningPathGap.update({ where: { id: gapId }, data });
  return serializePath(await findOwnedPath(prisma, userId, pathId));
}

export async function recalculateProgress(prisma, userId, pathId) {
  const path = await prisma.learningPath.findFirst({ where: { id: pathId, userId }, include: { items: true } });
  if (!path) return null;
  const considered = path.items.filter((item) => item.status !== "skipped");
  const completed = considered.filter((item) => item.status === "completed").length;
  const progress = considered.length ? completed / considered.length : 0;
  await prisma.learningPath.update({ where: { id: pathId }, data: { progress, status: progress === 1 ? "completed" : path.status === "completed" ? "active" : path.status } });
  return progress;
}

async function normalizePositions(prisma, userId, pathId) {
  const path = await findOwnedPath(prisma, userId, pathId);
  if (!path) return;
  await prisma.$transaction(path.items.map((item, position) => prisma.learningPathItem.update({ where: { id: item.id }, data: { position } })));
}
function estimateMinutes(bucket) { return { short: 5, medium: 15, long: 35, unknown: 12 }[bucket] || 12; }
function clean(value, max) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, max); }
function clampInt(value, min, max, fallback) { const n = Number.parseInt(value, 10); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; }
