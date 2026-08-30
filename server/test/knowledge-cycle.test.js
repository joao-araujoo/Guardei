import test from "node:test";
import assert from "node:assert/strict";
import { scheduleNextReview, REVIEW_INTERVAL_LIMITS, EASE_LIMITS } from "../src/reviews/scheduler.js";
import { validateReflectionPayload, validateCardPayload, validateReviewPayload, validateApplicationPayload, normalizeCardSuggestions, sanitizeEvidenceUrl } from "../src/reviews/reviewSchema.js";
import { recordReviewAttempt, getTodayHub, buildReviewSession } from "../src/reviews/reviewService.js";
import { getKnowledgeDashboard, calculateReviewStreak, countRecoveredCards } from "../src/knowledge/knowledgeService.js";
globalThis.prisma = {};
const { toDbVideoPatch, fromDbVideo, normalizeApplicationStatus } = await import("../src/routes/videoRoutes.js");
const { applyVideoState, recomputeVideoApplicationState } = await import("../src/routes/applicationRoutes.js");

const now = new Date("2026-07-13T12:00:00.000Z");

function card(overrides = {}) {
  return { id: "card-1", userId: "user-1", videoId: "video-1", status: "active", easeFactor: 2.5, intervalDays: 0, repetitions: 0, nextReviewAt: now, ...overrides };
}

test("primeiro acerto agenda a proxima revisao em um dia", () => {
  const result = scheduleNextReview(card(), "good", { now, confidence: 3 });
  assert.equal(result.intervalDays, 1);
  assert.equal(result.repetitions, 1);
  assert.equal(result.nextReviewAt.toISOString(), "2026-07-14T12:00:00.000Z");
});

test("primeiro erro reinicia repeticoes e reduz facilidade", () => {
  const result = scheduleNextReview(card({ repetitions: 4, intervalDays: 20 }), "again", { now });
  assert.equal(result.intervalDays, 1);
  assert.equal(result.repetitions, 0);
  assert.ok(result.easeFactor < 2.5);
});

test("sequencia de acertos aumenta intervalos de forma deterministica", () => {
  let state = card();
  const intervals = [];
  for (const date of ["2026-07-13", "2026-07-14", "2026-07-17", "2026-07-25"]) {
    const result = scheduleNextReview(state, "good", { now: new Date(`${date}T12:00:00.000Z`), confidence: 4 });
    intervals.push(result.intervalDays);
    state = { ...state, repetitions: result.repetitions, intervalDays: result.intervalDays, easeFactor: result.easeFactor, nextReviewAt: result.nextReviewAt };
  }
  assert.deepEqual(intervals.slice(0, 2), [1, 3]);
  assert.ok(intervals[2] > intervals[1]);
  assert.ok(intervals[3] > intervals[2]);
});

test("cartao dificil cresce pouco e cartao facil cresce mais", () => {
  const base = card({ repetitions: 3, intervalDays: 10, nextReviewAt: now });
  const hard = scheduleNextReview(base, "hard", { now });
  const easy = scheduleNextReview(base, "easy", { now, confidence: 5 });
  assert.equal(hard.intervalDays, 12);
  assert.ok(easy.intervalDays > hard.intervalDays);
});

test("revisao atrasada concede bonus limitado sem crescimento descontrolado", () => {
  const due = new Date(now.getTime() - 30 * 86_400_000);
  const result = scheduleNextReview(card({ repetitions: 4, intervalDays: 10, nextReviewAt: due }), "good", { now, confidence: 3 });
  assert.ok(result.overdueDays >= 30);
  assert.ok(result.intervalDays <= Math.round(10 * 2.5 * 1.15));
});

test("intervalos e facilidade respeitam limites", () => {
  const result = scheduleNextReview(card({ repetitions: 100, intervalDays: 365, easeFactor: 3.2 }), "easy", { now, confidence: 5 });
  assert.equal(result.intervalDays, REVIEW_INTERVAL_LIMITS.max);
  assert.equal(result.easeFactor, EASE_LIMITS.max);
  const low = scheduleNextReview(card({ easeFactor: 1.3 }), "again", { now });
  assert.equal(low.easeFactor, EASE_LIMITS.min);
});

test("datas calculadas permanecem validas", () => {
  for (const rating of ["again", "hard", "good", "easy"]) {
    const result = scheduleNextReview(card(), rating, { now });
    assert.equal(Number.isNaN(result.nextReviewAt.getTime()), false);
    assert.ok(result.nextReviewAt > now);
  }
});

test("rejeita rating invalido", () => {
  assert.throws(() => scheduleNextReview(card(), "perfeito", { now }), /avaliacao/i);
  assert.throws(() => validateReviewPayload({ rating: 9 }), /rating/i);
});

test("reflexao vazia e reflexao longa sao rejeitadas", () => {
  assert.throws(() => validateReflectionPayload({}), /ao menos/i);
  assert.throws(() => validateReflectionPayload({ mainLearning: "x".repeat(1_001) }), /limite/i);
});

test("reflexao valida confiança acessivel de 1 a 5", () => {
  const result = validateReflectionPayload({ mainLearning: "Aprendi a separar sessao de token.", confidence: 4 });
  assert.equal(result.confidence, 4);
});

test("geracao de cartoes e limitada e valida respostas estruturadas", () => {
  const cards = normalizeCardSuggestions({ cards: Array.from({ length: 12 }, (_, index) => ({ question: `Pergunta ${index}`, answer: `Resposta ${index}`, cardType: index === 0 ? "invalid" : "question_answer" })) }, 10);
  assert.equal(cards.length, 5);
  assert.equal(cards[0].cardType, "question_answer");
  assert.equal(normalizeCardSuggestions({ cards: [{ question: "", answer: "x" }] }, 3).length, 0);
});

test("cartao manual exige item, pergunta e resposta", () => {
  assert.throws(() => validateCardPayload({ videoId: "v1", question: "Q" }), /resposta/i);
  const result = validateCardPayload({ videoId: "v1", question: "Q", answer: "A", cardType: "decision" });
  assert.equal(result.cardType, "decision");
});

test("URLs de evidencia aceitam somente HTTP ou HTTPS", () => {
  assert.match(sanitizeEvidenceUrl("https://example.com/prova"), /^https:/);
  assert.throws(() => sanitizeEvidenceUrl("javascript:alert(1)"), /HTTP/i);
});

test("conclusao de aplicacao exige evidencia ou reflexao", () => {
  assert.throws(() => validateApplicationPayload({ title: "Aplicar", status: "completed" }), /evidencia/i);
  const result = validateApplicationPayload({ title: "Aplicar", status: "completed", evidenceText: "Implementei no projeto." });
  assert.equal(result.status, "completed");
});

test("marcar consumo nao marca aplicado", () => {
  const patch = toDbVideoPatch({ consumedAt: now.toISOString(), watchedSeconds: 300 });
  assert.equal(patch.status, undefined);
  assert.equal(patch.applicationStatus, undefined);
  assert.equal(patch.consumedAt.toISOString(), now.toISOString());
  assert.equal(patch.watchedAt.toISOString(), now.toISOString());
});

test("registros antigos aplicados permanecem identificados como historicos", () => {
  assert.equal(normalizeApplicationStatus(undefined, "aplicado"), "legacy_applied");
  const serialized = fromDbVideo({ id: "v", status: "aplicado", watchedAt: now, consumedAt: null, createdAt: now, updatedAt: now, capsule: null });
  assert.equal(serialized.consumedAt, now.toISOString());
});

test("concluir compromisso marca aplicacao real separadamente", async () => {
  const writes = [];
  const tx = { video: { update: async (input) => { writes.push(input); return input.data; } } };
  await applyVideoState(tx, { id: "v1", applicationStatus: "planned" }, { status: "completed", completedAt: now, reflection: "Funcionou", evidenceUrl: "https://example.com", evidenceText: null, description: "Aplicar" }, now);
  assert.equal(writes[0].data.status, "aplicado");
  assert.equal(writes[0].data.applicationStatus, "completed");
  assert.equal(writes[0].data.appliedAt, now);
});

test("remover a ultima aplicacao real recalcula o estado do conteudo", async () => {
  const writes = [];
  const tx = {
    applicationCommitment: { findMany: async () => [] },
    video: { update: async (input) => { writes.push(input); return input.data; } },
  };
  await recomputeVideoApplicationState(tx, "user-1", { id: "v1", status: "aplicado", applicationStatus: "completed" }, "v1", now);
  assert.equal(writes[0].data.applicationStatus, "none");
  assert.equal(writes[0].data.status, "rever");
  assert.equal(writes[0].data.appliedAt, null);
});

test("registro historico aplicado nao e apagado ao recalcular compromissos", async () => {
  const writes = [];
  const tx = { applicationCommitment: { findMany: async () => [] }, video: { update: async (input) => writes.push(input) } };
  await recomputeVideoApplicationState(tx, "user-1", { id: "v1", status: "aplicado", applicationStatus: "legacy_applied" }, "v1", now);
  assert.equal(writes.length, 0);
});

test("usuario nao consegue revisar cartao de outra conta", async () => {
  const prisma = { knowledgeCard: { findFirst: async () => null } };
  const result = await recordReviewAttempt({ prisma, userId: "attacker", cardId: "card-owner", payload: { rating: "good", answerText: null }, now });
  assert.equal(result.notFound, true);
});

test("cartao suspenso nao pode ser revisado", async () => {
  const prisma = { knowledgeCard: { findFirst: async () => card({ status: "suspended" }) } };
  const result = await recordReviewAttempt({ prisma, userId: "user-1", cardId: "card-1", payload: { rating: "good", answerText: null }, now });
  assert.equal(result.conflict, true);
  assert.equal(result.code, "CARD_SUSPENDED");
});

test("tentativa registra intervalo anterior e novo sem salvar resposta pessoal no retorno", async () => {
  const stored = { attempts: [], updates: [] };
  const owned = { ...card(), video: { id: "video-1", titleAi: "Teste", url: "https://example.com", category: "dev" } };
  const prisma = {
    knowledgeCard: {
      findFirst: async () => owned,
      update: async ({ data }) => { stored.updates.push(data); return { ...owned, ...data }; },
    },
    contentReflection: { findFirst: async () => ({ confidence: 4 }) },
    reviewAttempt: { create: async ({ data }) => { stored.attempts.push(data); return { id: "a1", ...data }; } },
  };
  const result = await recordReviewAttempt({ prisma, userId: "user-1", cardId: "card-1", payload: { rating: "good", answerText: "Minha resposta" }, now });
  assert.equal(result.attempt.previousInterval, 0);
  assert.equal(result.attempt.nextInterval, 1);
  assert.equal(result.attempt.answerText, undefined);
  assert.equal(result.attempt.answerRecorded, true);
});

test("central Hoje separa decisoes, cartoes, aplicacoes e trilhas", async () => {
  const prisma = todayPrisma();
  const data = await getTodayHub({ prisma, userId: "user-1", now });
  assert.equal(data.counts.decisions, 1);
  assert.equal(data.counts.dueCards, 1);
  assert.equal(data.counts.applications, 1);
  assert.equal(data.counts.activePaths, 1);
  assert.ok(data.nextAction.title);
  assert.ok(data.sessions.five.activities.length >= 1);
});

test("sessao respeita orcamento aproximado", () => {
  const session = buildReviewSession({ minutes: 2, cards: Array.from({ length: 10 }, (_, i) => ({ id: i })), applications: [{ id: "a" }], decisions: [], paths: [] });
  assert.ok(session.estimatedSeconds <= 120 || session.activities.length === 1);
  assert.ok(session.activities.length <= 3);
});

test("dashboard nao calcula retencao sem tentativas", async () => {
  const data = await getKnowledgeDashboard({ prisma: dashboardPrisma({ attempts: [] }), userId: "user-1", days: 30, now });
  assert.equal(data.metrics.recallRate, null);
  assert.match(data.summary.join(" "), /nao ha tentativas/i);
});

test("dashboard calcula retencao, confiança e aplicacoes reais", async () => {
  const attempts = [
    attempt("c1", "again", "2026-07-10"),
    attempt("c1", "good", "2026-07-11"),
    attempt("c2", "easy", "2026-07-12"),
  ];
  const data = await getKnowledgeDashboard({ prisma: dashboardPrisma({ attempts }), userId: "user-1", days: 30, now });
  assert.equal(data.metrics.recallRate, 2 / 3);
  assert.equal(data.metrics.averageConfidence, 4);
  assert.equal(data.metrics.contentsApplied, 1);
  assert.equal(data.metrics.legacyApplied, 1);
  assert.equal(data.metrics.recoveredCount, 1);
});

test("streak e recuperacao sao baseados em tentativas reais", () => {
  const attempts = [attempt("c1", "again", "2026-07-11"), attempt("c1", "good", "2026-07-12"), attempt("c2", "easy", "2026-07-13")];
  assert.equal(calculateReviewStreak(attempts, now), 3);
  assert.equal(countRecoveredCards(attempts), 1);
});

test("novas rotas exigem autenticacao", async () => {
  process.env.NODE_ENV = "test";
  globalThis.prisma = {};
  const { createApp } = await import("../src/index.js");
  const server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const path of ["/api/reviews/today", "/api/cards", "/api/applications", "/api/knowledge/dashboard", "/api/videos/v1/reflection"]) {
      const response = await fetch(`${base}${path}`);
      assert.equal(response.status, 401);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

function todayPrisma() {
  const video = { id: "v1", titleAi: "React", url: "https://example.com", category: "dev", status: "inbox", priority: "alta", createdAt: now };
  return {
    video: { findMany: async () => [video] },
    knowledgeCard: { findMany: async () => [{ ...card(), question: "Q", answer: "A", createdAt: now, updatedAt: now, video }] },
    applicationCommitment: { findMany: async () => [{ id: "app1", userId: "user-1", videoId: "v1", title: "Aplicar", status: "planned", dueAt: now, createdAt: now, updatedAt: now, video, learningPath: null }] },
    learningPath: { findMany: async () => [{ id: "p1", title: "React", objective: "Aprender", progress: 0, items: [{ id: "pi1", status: "pending", section: "Base", estimatedMinutes: 5, video }] }] },
  };
}

function dashboardPrisma({ attempts }) {
  return {
    video: { findMany: async () => [
      { id: "v1", category: "dev", tags: [], consumedAt: now, watchedAt: now, appliedAt: now, applicationStatus: "completed", createdAt: now },
      { id: "v2", category: "design", tags: [], consumedAt: null, watchedAt: now, appliedAt: null, applicationStatus: "legacy_applied", createdAt: now },
    ] },
    contentReflection: { findMany: async () => [{ id: "r1", videoId: "v1", confidence: 4, createdAt: now }] },
    knowledgeCard: { findMany: async () => [{ id: "c1", status: "active", nextReviewAt: now, videoId: "v1", video: { category: "dev", tags: [] } }] },
    reviewAttempt: { findMany: async () => attempts },
    applicationCommitment: { findMany: async () => [{ id: "a1", status: "completed", completedAt: now, createdAt: now, videoId: "v1", learningPathId: "p1" }] },
    learningPath: { findMany: async () => [{ id: "p1" }] },
  };
}

function attempt(cardId, rating, date) {
  return { id: `${cardId}-${date}-${rating}`, knowledgeCardId: cardId, rating, reviewedAt: new Date(`${date}T12:00:00.000Z`), knowledgeCard: { id: cardId, video: { category: cardId === "c1" ? "dev" : "design", tags: [] } } };
}
