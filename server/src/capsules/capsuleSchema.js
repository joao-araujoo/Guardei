export const CAPSULE_LIMITS = {
  summary: 600,
  item: 320,
  rationale: 500,
  evidence: 420,
  keyPoints: 7,
  concepts: 8,
  practicalApplications: 6,
  actionItems: 6,
  reflectionQuestions: 6,
  evidenceSnippets: 5,
};

export const CAPSULE_COVERAGES = ["full_content", "user_content", "metadata_only", "partial_content"];
export const CAPSULE_STATUSES = ["idle", "extracting", "generating", "completed", "limited", "failed"];

export function validateCapsulePayload(body = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "O payload da capsula deve ser um objeto JSON." };
  }
  if (body.sourceText !== undefined && typeof body.sourceText !== "string") {
    return { ok: false, message: "sourceText deve ser um texto." };
  }
  const sourceText = body.sourceText || "";
  if (sourceText.length > 80_000) return { ok: false, message: "O texto fornecido excede o limite de 80 mil caracteres." };
  if (body.analysisMode !== undefined && typeof body.analysisMode !== "string") {
    return { ok: false, message: "analysisMode deve ser um texto." };
  }
  const analysisMode = body.analysisMode || "auto";
  if (!["auto", "metadata_only"].includes(analysisMode)) return { ok: false, message: "Modo de analise invalido." };
  if (body.forceRegenerate !== undefined && typeof body.forceRegenerate !== "boolean") {
    return { ok: false, message: "forceRegenerate deve ser booleano." };
  }
  return { ok: true, value: { sourceText, analysisMode, forceRegenerate: Boolean(body.forceRegenerate) } };
}

export function normalizeCapsuleResult(raw = {}, context = {}) {
  const coverage = CAPSULE_COVERAGES.includes(context.coverage) ? context.coverage : "metadata_only";
  const summary = clampString(raw.summary, fallbackSummary(context), CAPSULE_LIMITS.summary);
  const keyPoints = normalizeStringArray(raw.keyPoints, CAPSULE_LIMITS.keyPoints, CAPSULE_LIMITS.item);
  const concepts = normalizeStringArray(raw.concepts, CAPSULE_LIMITS.concepts, CAPSULE_LIMITS.item);
  const practicalApplications = normalizeStringArray(raw.practicalApplications, CAPSULE_LIMITS.practicalApplications, CAPSULE_LIMITS.item);
  const actionItems = normalizeStringArray(raw.actionItems, CAPSULE_LIMITS.actionItems, CAPSULE_LIMITS.item);
  const reflectionQuestions = normalizeStringArray(raw.reflectionQuestions, CAPSULE_LIMITS.reflectionQuestions, CAPSULE_LIMITS.item);
  const evidenceSnippets = normalizeEvidence(raw.evidenceSnippets);
  const confidence = Number(raw.aiConfidence);

  return {
    status: coverage === "metadata_only" || coverage === "partial_content" ? "limited" : "completed",
    coverage,
    language: "pt-BR",
    summary,
    keyPoints,
    concepts,
    practicalApplications,
    actionItems,
    reflectionQuestions,
    evidenceSnippets,
    aiModel: clampString(context.aiModel, "unknown", 120),
    aiConfidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : defaultConfidence(coverage),
    aiRationale: clampString(raw.aiRationale, context.sourceDescription || "Analise normalizada pelo backend.", CAPSULE_LIMITS.rationale),
  };
}

export function serializeCapsule(capsule) {
  if (!capsule) return null;
  const { userId, sourceText, ...safe } = capsule;
  return {
    ...safe,
    hasSourceText: Boolean(sourceText),
    generatedAt: capsule.generatedAt?.toISOString?.() || capsule.generatedAt,
    createdAt: capsule.createdAt?.toISOString?.() || capsule.createdAt,
    updatedAt: capsule.updatedAt?.toISOString?.() || capsule.updatedAt,
  };
}

function normalizeStringArray(value, maxItems, maxLength) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => clampString(item, "", maxLength)).filter(Boolean))].slice(0, maxItems);
}

function normalizeEvidence(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return { text: clampString(item, "", CAPSULE_LIMITS.evidence), source: "conteudo" };
      return {
        text: clampString(item?.text, "", CAPSULE_LIMITS.evidence),
        source: clampString(item?.source, "conteudo", 80),
      };
    })
    .filter((item) => item.text)
    .slice(0, CAPSULE_LIMITS.evidenceSnippets);
}

function fallbackSummary(context) {
  return context.coverage === "metadata_only"
    ? "Analise limitada aos metadados disponiveis para este item."
    : "Conteudo organizado em uma capsula de conhecimento.";
}

function defaultConfidence(coverage) {
  return { full_content: 0.82, user_content: 0.8, partial_content: 0.58, metadata_only: 0.38 }[coverage] || 0.35;
}

function clampString(value, fallback, maxLength) {
  const text = String(value || fallback || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
}
