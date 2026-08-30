export const PATH_LIMITS = {
  title: 140,
  objective: 800,
  description: 1_500,
  currentLevel: 60,
  resultType: 120,
  section: 120,
  reason: 320,
  note: 600,
  gapTitle: 160,
  gapDescription: 500,
  maxItems: 40,
  maxGaps: 10,
};

export function validatePathPayload(value = {}, { partial = false } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid("O payload da trilha deve ser um objeto JSON.");
  const output = {};
  const stringFields = {
    title: PATH_LIMITS.title,
    objective: PATH_LIMITS.objective,
    description: PATH_LIMITS.description,
    currentLevel: PATH_LIMITS.currentLevel,
    resultType: PATH_LIMITS.resultType,
  };
  for (const [field, max] of Object.entries(stringFields)) {
    if (value[field] !== undefined) {
      if (typeof value[field] !== "string") return invalid(`${field} deve ser um texto.`);
      output[field] = clean(value[field], max);
    }
  }
  if (!partial && !output.title) return invalid("O nome da trilha e obrigatorio.");
  if (!partial && !output.objective) return invalid("O objetivo da trilha e obrigatorio.");
  if (value.weeklyMinutes !== undefined) output.weeklyMinutes = clampInt(value.weeklyMinutes, 5, 10_080, 60);
  if (value.deadline !== undefined) {
    if (!value.deadline) output.deadline = null;
    else {
      const date = new Date(value.deadline);
      if (Number.isNaN(date.getTime())) return invalid("Prazo invalido.");
      output.deadline = date;
    }
  }
  if (value.status !== undefined) {
    if (!["active", "completed", "archived"].includes(value.status)) return invalid("Status de trilha invalido.");
    output.status = value.status;
  }
  if (value.autoOrganize !== undefined) {
    if (typeof value.autoOrganize !== "boolean") return invalid("autoOrganize deve ser booleano.");
    output.autoOrganize = value.autoOrganize;
  }
  if (value.categories !== undefined) {
    if (!Array.isArray(value.categories) || value.categories.some((item) => typeof item !== "string")) return invalid("categories deve ser uma lista de textos.");
    output.categories = [...new Set(value.categories.map((item) => clean(item, 80)).filter(Boolean))].slice(0, 12);
  } else if (!partial) {
    output.categories = [];
  }
  return { ok: true, value: output };
}

export function normalizeGeneratedPath(raw = {}, candidateIds = []) {
  const allowed = new Set(candidateIds);
  const seen = new Set();
  const items = (Array.isArray(raw.items) ? raw.items : [])
    .map((item, index) => ({
      videoId: clean(item?.videoId, 100),
      position: index,
      section: clean(item?.section, PATH_LIMITS.section) || "Etapa 1",
      reason: clean(item?.reason, PATH_LIMITS.reason) || "Selecionado por relevancia ao objetivo.",
      estimatedMinutes: clampInt(item?.estimatedMinutes, 1, 600, 10),
    }))
    .filter((item) => allowed.has(item.videoId) && !seen.has(item.videoId) && seen.add(item.videoId))
    .slice(0, PATH_LIMITS.maxItems);

  const gaps = (Array.isArray(raw.gaps) ? raw.gaps : [])
    .map((gap) => ({
      title: clean(gap?.title, PATH_LIMITS.gapTitle),
      description: clean(gap?.description, PATH_LIMITS.gapDescription),
      importance: ["low", "medium", "high"].includes(gap?.importance) ? gap.importance : "medium",
    }))
    .filter((gap) => gap.title && gap.description)
    .slice(0, PATH_LIMITS.maxGaps);

  return { items, gaps };
}

export function serializePath(path) {
  if (!path) return null;
  const { userId, ...safe } = path;
  return {
    ...safe,
    deadline: path.deadline?.toISOString?.() || path.deadline,
    createdAt: path.createdAt?.toISOString?.() || path.createdAt,
    updatedAt: path.updatedAt?.toISOString?.() || path.updatedAt,
    items: (path.items || []).map((item) => ({
      ...item,
      completedAt: item.completedAt?.toISOString?.() || item.completedAt,
      createdAt: item.createdAt?.toISOString?.() || item.createdAt,
      updatedAt: item.updatedAt?.toISOString?.() || item.updatedAt,
    })),
    gaps: (path.gaps || []).map((gap) => ({
      ...gap,
      createdAt: gap.createdAt?.toISOString?.() || gap.createdAt,
      updatedAt: gap.updatedAt?.toISOString?.() || gap.updatedAt,
    })),
  };
}

function invalid(message) {
  return { ok: false, message };
}
function clean(value, max) {
  return String(value || "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
function clampInt(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}
