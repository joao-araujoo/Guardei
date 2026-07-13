export const KNOWLEDGE_LIMITS = Object.freeze({
  reflectionField: 1_000,
  cardQuestion: 500,
  cardAnswer: 1_500,
  cardHint: 400,
  reviewAnswer: 2_000,
  applicationTitle: 180,
  applicationDescription: 1_500,
  evidenceText: 1_500,
  applicationReflection: 2_000,
  evidenceUrl: 2_000,
  maxGeneratedCards: 5,
});

const CARD_TYPES = ["question_answer", "concept_explanation", "situation_application", "explain_own_words", "decision", "application"];
const CARD_SOURCES = ["manual", "capsule", "reflection", "ai"];
const CARD_STATUSES = ["active", "suspended"];
const APPLICATION_STATUSES = ["planned", "in_progress", "completed", "dismissed"];
const REVIEW_RATINGS = ["again", "hard", "good", "easy"];

export function validateReflectionPayload(value = {}) {
  const body = object(value, "A reflexao deve ser um objeto JSON.");
  const result = {
    mainLearning: optionalText(body.mainLearning, KNOWLEDGE_LIMITS.reflectionField, "mainLearning"),
    rememberLater: optionalText(body.rememberLater, KNOWLEDGE_LIMITS.reflectionField, "rememberLater"),
    applicationIdea: optionalText(body.applicationIdea, KNOWLEDGE_LIMITS.reflectionField, "applicationIdea"),
    confidence: optionalInt(body.confidence, 1, 5, "confidence"),
  };
  if (!result.mainLearning && !result.rememberLater && !result.applicationIdea && result.confidence === null) {
    throw inputError("REFLECTION_EMPTY", "Registre ao menos um aprendizado, lembranca, ideia de aplicacao ou nivel de compreensao.");
  }
  return result;
}

export function validateCardPayload(value = {}, { partial = false } = {}) {
  const body = object(value, "O cartao deve ser um objeto JSON.");
  const result = {};
  if (body.videoId !== undefined) result.videoId = requiredText(body.videoId, 120, "videoId");
  if (body.question !== undefined) result.question = requiredText(body.question, KNOWLEDGE_LIMITS.cardQuestion, "question");
  if (body.answer !== undefined) result.answer = requiredText(body.answer, KNOWLEDGE_LIMITS.cardAnswer, "answer");
  if (body.hint !== undefined) result.hint = optionalText(body.hint, KNOWLEDGE_LIMITS.cardHint, "hint");
  if (body.cardType !== undefined) result.cardType = enumValue(body.cardType, CARD_TYPES, "cardType");
  if (body.sourceType !== undefined) result.sourceType = enumValue(body.sourceType, CARD_SOURCES, "sourceType");
  if (body.status !== undefined) result.status = enumValue(body.status, CARD_STATUSES, "status");
  if (body.nextReviewAt !== undefined) result.nextReviewAt = optionalDate(body.nextReviewAt, "nextReviewAt");
  if (!partial) {
    if (!result.videoId) throw inputError("VIDEO_ID_REQUIRED", "videoId e obrigatorio.");
    if (!result.question) throw inputError("CARD_QUESTION_REQUIRED", "A pergunta e obrigatoria.");
    if (!result.answer) throw inputError("CARD_ANSWER_REQUIRED", "A resposta e obrigatoria.");
  }
  return result;
}

export function validateReviewPayload(value = {}) {
  const body = object(value, "A revisao deve ser um objeto JSON.");
  return {
    answerText: optionalText(body.answerText, KNOWLEDGE_LIMITS.reviewAnswer, "answerText"),
    rating: enumValue(body.rating, REVIEW_RATINGS, "rating"),
  };
}

export function validateApplicationPayload(value = {}, { partial = false } = {}) {
  const body = object(value, "O compromisso deve ser um objeto JSON.");
  const result = {};
  if (body.title !== undefined) result.title = requiredText(body.title, KNOWLEDGE_LIMITS.applicationTitle, "title");
  if (body.description !== undefined) result.description = optionalText(body.description, KNOWLEDGE_LIMITS.applicationDescription, "description");
  if (body.learningPathId !== undefined) result.learningPathId = optionalText(body.learningPathId, 120, "learningPathId");
  if (body.dueAt !== undefined) result.dueAt = optionalDate(body.dueAt, "dueAt");
  if (body.status !== undefined) result.status = enumValue(body.status, APPLICATION_STATUSES, "status");
  if (body.evidenceUrl !== undefined) result.evidenceUrl = sanitizeEvidenceUrl(body.evidenceUrl);
  if (body.evidenceText !== undefined) result.evidenceText = optionalText(body.evidenceText, KNOWLEDGE_LIMITS.evidenceText, "evidenceText");
  if (body.reflection !== undefined) result.reflection = optionalText(body.reflection, KNOWLEDGE_LIMITS.applicationReflection, "reflection");
  if (body.reviewAgain !== undefined) {
    if (typeof body.reviewAgain !== "boolean") throw inputError("REVIEW_AGAIN_INVALID", "reviewAgain deve ser booleano.");
    result.reviewAgain = body.reviewAgain;
  }
  if (!partial && !result.title) throw inputError("APPLICATION_TITLE_REQUIRED", "O titulo do compromisso e obrigatorio.");
  if (result.status === "completed" && !result.evidenceText && !result.evidenceUrl && !result.reflection) {
    throw inputError("APPLICATION_EVIDENCE_REQUIRED", "Ao concluir, registre uma evidencia ou reflexao curta sobre o que foi aplicado.");
  }
  return result;
}

export function normalizeCardSuggestions(raw = {}, maxCards = 3) {
  const limit = Math.min(KNOWLEDGE_LIMITS.maxGeneratedCards, Math.max(1, Number(maxCards) || 3));
  const seen = new Set();
  return (Array.isArray(raw.cards) ? raw.cards : Array.isArray(raw) ? raw : [])
    .map((card) => ({
      question: optionalText(card?.question, KNOWLEDGE_LIMITS.cardQuestion, "question"),
      answer: optionalText(card?.answer, KNOWLEDGE_LIMITS.cardAnswer, "answer"),
      hint: optionalText(card?.hint, KNOWLEDGE_LIMITS.cardHint, "hint"),
      cardType: CARD_TYPES.includes(card?.cardType) ? card.cardType : "question_answer",
      sourceType: "ai",
    }))
    .filter((card) => card.question && card.answer && !seen.has(card.question.toLowerCase()) && seen.add(card.question.toLowerCase()))
    .slice(0, limit);
}

export function sanitizeEvidenceUrl(value) {
  const text = optionalText(value, KNOWLEDGE_LIMITS.evidenceUrl, "evidenceUrl");
  if (!text) return null;
  let url;
  try { url = new URL(text); } catch { throw inputError("EVIDENCE_URL_INVALID", "O link de evidencia e invalido."); }
  if (!["http:", "https:"].includes(url.protocol)) throw inputError("EVIDENCE_URL_INVALID", "Use um link HTTP ou HTTPS para a evidencia.");
  url.username = "";
  url.password = "";
  return url.toString().slice(0, KNOWLEDGE_LIMITS.evidenceUrl);
}

export function clampGeneratedCardLimit(value) {
  const number = Number(value ?? 3);
  if (!Number.isFinite(number)) throw inputError("CARD_LIMIT_INVALID", "O limite de cartoes deve ser numerico.");
  return Math.min(KNOWLEDGE_LIMITS.maxGeneratedCards, Math.max(1, Math.round(number)));
}

function object(value, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw inputError("INVALID_PAYLOAD", message);
  return value;
}
function requiredText(value, max, field) {
  const text = optionalText(value, max, field);
  if (!text) throw inputError(`${field.toUpperCase()}_REQUIRED`, `${field} e obrigatorio.`);
  return text;
}
function optionalText(value, max, field) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw inputError(`${field.toUpperCase()}_INVALID`, `${field} deve ser um texto.`);
  const text = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
  if (text.length > max) throw inputError(`${field.toUpperCase()}_TOO_LONG`, `${field} excede o limite de ${max} caracteres.`);
  return text || null;
}
function optionalInt(value, min, max, field) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw inputError(`${field.toUpperCase()}_INVALID`, `${field} deve estar entre ${min} e ${max}.`);
  return number;
}
function optionalDate(value, field) {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(value);
  const now = Date.now();
  if (Number.isNaN(date.getTime()) || date.getTime() < new Date("2000-01-01").getTime() || date.getTime() > now + 20 * 365 * 86_400_000) {
    throw inputError(`${field.toUpperCase()}_INVALID`, `${field} possui uma data invalida.`);
  }
  return date;
}
function enumValue(value, allowed, field) {
  if (typeof value !== "string" || !allowed.includes(value)) throw inputError(`${field.toUpperCase()}_INVALID`, `${field} possui um valor invalido.`);
  return value;
}
function inputError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.status = 400;
  return error;
}
