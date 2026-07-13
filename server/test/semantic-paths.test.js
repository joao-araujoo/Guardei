import test from "node:test";
import assert from "node:assert/strict";
import { createLocalEmbedding, cosineSimilarity } from "../src/embeddings/localEmbedding.js";
import { ensureVideoEmbedding, markEmbeddingOutdated } from "../src/embeddings/embeddingService.js";
import { calculateHybridScore, calculateTextualScore, hybridSearch } from "../src/search/searchService.js";
import { normalizeGeneratedPath, validatePathPayload } from "../src/paths/pathSchema.js";
import { generatePathPlan } from "../src/paths/pathGenerator.js";
import { addPathItem, createPath, removePathItem, reorderPathItems } from "../src/paths/pathService.js";

const now = new Date("2026-07-13T12:00:00Z");
const baseVideo = {
  id: "v1", userId: "u1", url: "https://example.com/1", titleAi: "Autenticacao segura com cookies e sessoes",
  titleCustom: null, titleOriginal: null, description: "Protecao de APIs Node", note: "Aplicar no meu SaaS", category: "dev",
  tags: ["auth", "cookies", "seguranca"], priority: "alta", status: "importante", mood: "focado", effort: "medio",
  durationBucket: "medium", summary: "", createdAt: now, updatedAt: now,
  capsule: { id: "c1", status: "completed", coverage: "full_content", summary: "Explica sessoes HTTP-only.", keyPoints: ["Rotacione sessoes"], concepts: ["JWT", "cookies", "sessao"], generatedAt: now },
  embedding: null,
};

test("calcula similaridade semantica deterministica", () => {
  const auth = createLocalEmbedding("autenticacao login sessao cookie jwt");
  const security = createLocalEmbedding("seguranca de login com cookies e sessoes");
  const cooking = createLocalEmbedding("receita de bolo com chocolate");
  assert.ok(cosineSimilarity(auth, security) > cosineSimilarity(auth, cooking));
  assert.equal(createLocalEmbedding("react hooks").length, 192);
});

test("combina pontuacao textual e semantica", () => {
  const textual = calculateTextualScore(baseVideo, "autenticacao do meu sistema");
  const hybrid = calculateHybridScore({ textualScore: textual, semanticScore: 0.9, attributeScore: 0.2, semanticAvailable: true });
  assert.ok(textual > 0);
  assert.ok(hybrid > textual * 0.36);
  assert.ok(hybrid <= 1);
});

test("isola a busca por usuario e nao expoe vetor", async () => {
  let receivedWhere;
  const prisma = {
    video: { findMany: async ({ where }) => { receivedWhere = where; return [baseVideo]; } },
  };
  const result = await hybridSearch({
    prisma, userId: "u1", params: { q: "melhorar autenticacao", limit: 10 },
    queryEmbedder: async query => createLocalEmbedding(query), scheduleRefresh: null,
  });
  assert.equal(receivedWhere.userId, "u1");
  assert.equal(result.results.length, 1);
  assert.equal("embedding" in result.results[0].item, false);
  assert.equal("vector" in result.results[0], false);
});

test("usa fallback textual quando embedding da consulta falha", async () => {
  const prisma = { video: { findMany: async () => [baseVideo] } };
  const result = await hybridSearch({
    prisma, userId: "u1", params: { q: "autenticacao segura", limit: 10 },
    queryEmbedder: async () => { throw new Error("offline"); }, scheduleRefresh: null,
  });
  assert.equal(result.mode, "textual_fallback");
  assert.equal(result.results[0].semanticScore, 0);
  assert.ok(result.results[0].textualScore > 0);
});

test("aplica filtros e paginacao com limites", async () => {
  let received;
  const videos = [0, 1, 2].map(index => ({ ...baseVideo, id: `v${index + 1}`, titleAi: `Conteudo ${index + 1}`, updatedAt: new Date(now.getTime() - index * 1000) }));
  const prisma = { video: { findMany: async args => { received = args; return videos; } } };
  const result = await hybridSearch({ prisma, userId: "u1", params: { q: "", category: "dev", status: "importante", limit: 1, offset: 1 }, scheduleRefresh: null });
  assert.equal(received.where.userId, "u1");
  assert.equal(received.where.category, "dev");
  assert.equal(received.where.status, "importante");
  assert.equal(result.limit, 1);
  assert.equal(result.offset, 1);
  assert.equal(result.results.length, 1);
  assert.equal(result.total, 3);
});

test("atualiza embedding quando o conteudo muda", async () => {
  let saved;
  const prisma = {
    video: { findFirst: async () => ({ ...baseVideo, embedding: { status: "indexed", contentHash: "antigo", vector: [1, 0] } }) },
    videoEmbedding: {
      upsert: async ({ update }) => { saved = { ...saved, ...update }; return saved; },
      update: async ({ data }) => { saved = { id: "e1", userId: "u1", videoId: "v1", ...saved, ...data }; return saved; },
    },
  };
  const result = await ensureVideoEmbedding({ prisma, userId: "u1", videoId: "v1", generator: async () => ({ provider: "test", model: "test-v1", dimensions: 3, vector: [0.1, 0.2, 0.3] }) });
  assert.equal(result.reused, false);
  assert.equal(result.embedding.status, "indexed");
  assert.equal(result.embedding.dimensions, 3);
  assert.notEqual(result.embedding.contentHash, "antigo");
});

test("marca embedding como desatualizado sem bloquear a edicao", async () => {
  let update;
  const prisma = {
    video: { findFirst: async ({ where }) => where.userId === "u1" ? { id: "v1" } : null },
    videoEmbedding: { upsert: async args => { update = args.update; return {}; } },
  };
  assert.equal(await markEmbeddingOutdated(prisma, "u1", "v1"), true);
  assert.equal(update.status, "outdated");
  assert.equal(await markEmbeddingOutdated({ video: { findFirst: async () => null } }, "u2", "v1"), false);
});

test("valida criacao de trilha e limita campos", () => {
  assert.equal(validatePathPayload({ title: "", objective: "" }).ok, false);
  const valid = validatePathPayload({ title: "Aprender React", objective: "Criar uma aplicacao", weeklyMinutes: 999999, categories: ["dev", "dev"] });
  assert.equal(valid.ok, true);
  assert.equal(valid.value.weeklyMinutes, 10080);
  assert.deepEqual(valid.value.categories, ["dev"]);
});

test("valida resposta estruturada sem aceitar IDs inventados", () => {
  const plan = normalizeGeneratedPath({
    items: [{ videoId: "v1", section: "Base", reason: "real" }, { videoId: "fake", section: "Base", reason: "inventado" }, { videoId: "v1", section: "Outra", reason: "duplicado" }],
    gaps: [{ title: "Testes", description: "Falta material", importance: "high" }],
  }, ["v1", "v2"]);
  assert.deepEqual(plan.items.map(item => item.videoId), ["v1"]);
  assert.equal(plan.gaps.length, 1);
});

test("gera lacuna quando nao existem candidatos", async () => {
  const plan = await generatePathPlan({ path: { objective: "Aprender testes", currentLevel: "iniciante" }, candidates: [] });
  assert.equal(plan.items.length, 0);
  assert.equal(plan.gaps.length, 1);
  assert.match(plan.gaps[0].description, /pesquise/i);
});

test("limita candidatos e identifica lacunas no fallback local", async () => {
  const candidates = Array.from({ length: 30 }, (_, index) => ({
    item: { ...baseVideo, id: `v${index}`, titleAi: `Referencia ${index}`, tags: ["arquitetura"], capsule: null },
    score: 0.9 - index / 100, reasons: ["Relacionado ao objetivo."],
  }));
  const plan = await generatePathPlan({ path: { objective: "Construir um sistema", currentLevel: "iniciante" }, candidates });
  assert.ok(plan.items.length <= 18);
  assert.ok(plan.gaps.some(gap => /introducao|pratica|entrega/i.test(`${gap.title} ${gap.description}`)));
});

test("cria trilha vinculada somente ao usuario autenticado", async () => {
  let data;
  const prisma = { learningPath: { create: async args => { data = args.data; return { id: "p1", progress: 0, status: "active", aiGenerated: false, autoOrganize: true, categories: [], createdAt: now, updatedAt: now, items: [], gaps: [], ...args.data }; } } };
  const path = await createPath(prisma, "u1", { title: "SaaS", objective: "Publicar um SaaS", categories: [] });
  assert.equal(data.userId, "u1");
  assert.equal(path.userId, undefined);
});

test("adiciona item manual somente quando video pertence ao usuario", async () => {
  let upserted;
  const path = { id: "p1", userId: "u1", title: "Trilha", objective: "Objetivo", progress: 0, status: "active", aiGenerated: false, autoOrganize: true, categories: [], createdAt: now, updatedAt: now, items: [], gaps: [] };
  const prisma = {
    learningPath: { findFirst: async () => path, update: async () => path },
    video: { findFirst: async ({ where }) => where.userId === "u1" ? { id: "v1", durationBucket: "short" } : null },
    learningPathItem: { upsert: async args => { upserted = args.create; }, findMany: async () => [] },
  };
  const result = await addPathItem(prisma, "u1", "p1", { videoId: "v1" });
  assert.equal(result.videoNotFound, undefined);
  assert.equal(upserted.manualAdded, true);
  assert.equal(upserted.videoId, "v1");
});

test("reordena itens com alternativa acessivel aos gestos", async () => {
  const updates = [];
  const items = [
    { id: "i1", videoId: "v1", position: 0, section: "Base", status: "pending", video: { id: "v1" } },
    { id: "i2", videoId: "v2", position: 1, section: "Pratica", status: "pending", video: { id: "v2" } },
  ];
  const path = { id: "p1", userId: "u1", title: "Trilha", objective: "Objetivo", progress: 0, status: "active", aiGenerated: false, autoOrganize: true, categories: [], createdAt: now, updatedAt: now, items, gaps: [] };
  const prisma = {
    learningPath: { findFirst: async () => path },
    learningPathItem: { update: async ({ where, data }) => { updates.push({ id: where.id, ...data }); return {}; } },
    $transaction: async promises => Promise.all(promises),
  };
  await reorderPathItems(prisma, "u1", "p1", [{ id: "i2", section: "Base" }, { id: "i1", section: "Base" }]);
  assert.deepEqual(updates.map(update => [update.id, update.position]), [["i2", 0], ["i1", 1]]);
});

test("remove item apenas dentro da trilha do usuario", async () => {
  let where;
  const prisma = {
    learningPathItem: { deleteMany: async args => { where = args.where; return { count: 1 }; }, update: async () => ({}) },
    learningPath: { findFirst: async () => ({ id: "p1", userId: "u1", title: "T", objective: "O", progress: 0, status: "active", aiGenerated: false, autoOrganize: true, categories: [], createdAt: now, updatedAt: now, items: [], gaps: [] }), update: async () => ({}) },
    $transaction: async values => Promise.all(values),
  };
  assert.equal(await removePathItem(prisma, "u1", "p1", "i1"), true);
  assert.equal(where.learningPath.is.userId, "u1");
});

test("protege rotas de busca, trilhas e conexoes sem sessao", async () => {
  process.env.NODE_ENV = "test";
  globalThis.prisma = {};
  const { createApp } = await import("../src/index.js");
  const server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  try {
    for (const pathname of ["/api/search?q=react", "/api/paths", "/api/connections/map"]) {
      const response = await fetch(`${base}${pathname}`);
      assert.equal(response.status, 401);
      const body = await response.json();
      assert.equal(body.ok, false);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    delete globalThis.prisma;
  }
});
