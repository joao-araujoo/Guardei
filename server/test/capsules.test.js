import test from "node:test";
import assert from "node:assert/strict";
import { parseAndValidateUrl, fetchTextWithRedirects, isBlockedIp } from "../src/security/urlSafety.js";
import { sanitizeAndExtractText, MAX_SOURCE_TEXT_CHARS } from "../src/capsules/contentSanitizer.js";
import { extractCapsuleSource } from "../src/capsules/contentExtractionService.js";
import { normalizeCapsuleResult, validateCapsulePayload } from "../src/capsules/capsuleSchema.js";
import { createRateLimiter, clearRateLimitStores } from "../src/middleware/rateLimit.js";
import { createOrRegenerateCapsule, findOwnedVideo } from "../src/capsules/capsuleService.js";

const video = {
  id: "video-1",
  userId: "user-1",
  url: "https://example.com/article",
  titleAi: "Artigo sobre React",
  description: "Uma introducao pratica ao React.",
  authorName: "Autor",
  tags: ["react", "frontend"],
  category: "dev",
};

test("bloqueia localhost, loopback e redes privadas", () => {
  for (const url of ["http://localhost/a", "http://127.0.0.1", "http://10.0.0.1", "http://169.254.169.254", "http://[::1]"]) {
    assert.throws(() => parseAndValidateUrl(url));
  }
  assert.equal(isBlockedIp("192.168.1.1"), true);
  assert.equal(isBlockedIp("8.8.8.8"), false);
});

test("valida novamente o destino apos redirecionamento", async () => {
  let calls = 0;
  await assert.rejects(
    fetchTextWithRedirects("https://example.com/start", {
      resolveImpl: async () => ({ address: "93.184.216.34", family: 4 }),
      requestImpl: async () => {
        calls += 1;
        return { statusCode: 302, headers: { location: "http://127.0.0.1/admin" }, body: "", bytes: 0 };
      },
    }),
    /privados|reservados|nao permitidos/i,
  );
  assert.equal(calls, 1);
});

test("remove elementos irrelevantes e limita o texto extraido", () => {
  const html = `<html><nav>menu secreto</nav><script>alert(1)</script><main><h1>Titulo</h1><p>${"conteudo ".repeat(20_000)}</p></main></html>`;
  const result = sanitizeAndExtractText(html, "text/html");
  assert.equal(result.text.includes("alert(1)"), false);
  assert.equal(result.text.includes("menu secreto"), false);
  assert.equal(result.text.length <= MAX_SOURCE_TEXT_CHARS, true);
  assert.equal(result.truncated, true);
});

test("garante propriedade ao buscar o item", async () => {
  const prisma = { video: { findFirst: async ({ where }) => where.userId === "owner" && where.id === "owned" ? { id: "owned" } : null } };
  assert.deepEqual(await findOwnedVideo(prisma, "owner", "owned"), { id: "owned" });
  assert.equal(await findOwnedVideo(prisma, "attacker", "owned"), null);
});

test("normaliza e limita a resposta estruturada da IA", () => {
  const capsule = normalizeCapsuleResult({
    summary: "x".repeat(1000),
    keyPoints: Array.from({ length: 20 }, (_, index) => `Ponto ${index} ${"z".repeat(400)}`),
    concepts: ["React", "React", "Estado"],
    evidenceSnippets: Array.from({ length: 10 }, () => ({ text: "e".repeat(600), source: "texto" })),
    aiConfidence: 7,
  }, { coverage: "metadata_only", aiModel: "test", sourceDescription: "metadados" });
  assert.equal(capsule.status, "limited");
  assert.equal(capsule.summary.length <= 600, true);
  assert.equal(capsule.keyPoints.length, 7);
  assert.equal(capsule.concepts.length, 2);
  assert.equal(capsule.evidenceSnippets.length, 5);
  assert.equal(capsule.aiConfidence, 1);
});

test("aplica rate limit por usuario e IP", () => {
  clearRateLimitStores();
  const middleware = createRateLimiter({ windowMs: 60_000, limit: 2, keyPrefix: "test" });
  const req = { user: { id: "u1" }, ip: "1.2.3.4", socket: {} };
  const statuses = [];
  const makeRes = () => ({
    setHeader() {},
    status(code) { statuses.push(code); return this; },
    json(payload) { this.payload = payload; return this; },
  });
  let nextCount = 0;
  middleware(req, makeRes(), () => { nextCount += 1; });
  middleware(req, makeRes(), () => { nextCount += 1; });
  middleware(req, makeRes(), () => { nextCount += 1; });
  assert.equal(nextCount, 2);
  assert.deepEqual(statuses, [429]);
});

test("cria fonte metadata_only para plataforma restrita", async () => {
  const result = await extractCapsuleSource({ video: { ...video, url: "https://youtube.com/watch?v=abc" } });
  assert.equal(result.coverage, "metadata_only");
  assert.match(result.sourceText, /React/);
});

test("prioriza texto fornecido pelo usuario", async () => {
  const result = await extractCapsuleSource({ video, sourceText: "Transcricao manual com detalhes importantes sobre componentes e estado." });
  assert.equal(result.coverage, "user_content");
  assert.match(result.sourceDescription, /fornecida pelo usuario/i);
});

test("rejeita texto manual acima do limite", () => {
  const result = validateCapsulePayload({ sourceText: "a".repeat(80_001) });
  assert.equal(result.ok, false);
});

test("marca a capsula como failed quando o gerador fica indisponivel", async () => {
  let capsule = null;
  const prisma = {
    video: { findFirst: async () => video },
    contentCapsule: {
      findFirst: async () => capsule,
      upsert: async ({ create }) => { capsule = { id: "c1", ...create, createdAt: new Date(), updatedAt: new Date() }; return capsule; },
      update: async ({ data }) => { capsule = { ...capsule, ...data, updatedAt: new Date() }; return capsule; },
    },
  };
  const result = await createOrRegenerateCapsule({
    prisma,
    userId: "user-1",
    videoId: "video-1",
    input: { sourceText: "Texto manual confiavel", analysisMode: "auto", forceRegenerate: false },
    extractor: async () => ({ coverage: "user_content", sourceText: "Texto manual confiavel", sourceTextHash: "hash", sourceDescription: "manual" }),
    generator: async () => { const error = new Error("offline"); error.code = "AI_UNAVAILABLE"; throw error; },
  });
  assert.equal(result.failed, true);
  assert.equal(result.capsule.status, "failed");
  assert.equal(result.capsule.errorCode, "AI_UNAVAILABLE");
});

test("rejeita tipos ambiguos no payload da capsula", () => {
  assert.equal(validateCapsulePayload({ sourceText: { text: "nao permitido" } }).ok, false);
  assert.equal(validateCapsulePayload({ analysisMode: 1 }).ok, false);
  assert.equal(validateCapsulePayload({ forceRegenerate: "true" }).ok, false);
});

test("nao inicia processamento para item de outro usuario", async () => {
  let wroteCapsule = false;
  const prisma = {
    video: { findFirst: async () => null },
    contentCapsule: {
      findFirst: async () => { throw new Error("nao deveria consultar"); },
      upsert: async () => { wroteCapsule = true; },
    },
  };
  const result = await createOrRegenerateCapsule({
    prisma,
    userId: "attacker",
    videoId: "video-1",
    input: { sourceText: "", analysisMode: "auto", forceRegenerate: false },
  });
  assert.equal(result.notFound, true);
  assert.equal(wroteCapsule, false);
});

test("cria capsula concluida a partir de texto fornecido pelo usuario", async () => {
  const prisma = createPrismaHarness(video);
  const result = await createOrRegenerateCapsule({
    prisma,
    userId: "user-1",
    videoId: "video-1",
    input: { sourceText: "Texto manual detalhado sobre componentes, estado e efeitos no React.", analysisMode: "auto", forceRegenerate: false },
    generator: async ({ source }) => normalizeCapsuleResult({
      summary: "Resumo baseado no texto manual.",
      keyPoints: ["Componentes organizam a interface."],
      aiConfidence: 0.9,
    }, { coverage: source.coverage, sourceDescription: source.sourceDescription, aiModel: "test" }),
  });
  assert.equal(result.failed, undefined);
  assert.equal(result.capsule.coverage, "user_content");
  assert.equal(result.capsule.status, "completed");
  assert.equal(result.capsule.hasSourceText, true);
  assert.equal(result.capsule.sourceText, undefined);
});

test("cria capsula limitada somente com metadados quando a plataforma e restrita", async () => {
  const restrictedVideo = { ...video, url: "https://www.youtube.com/watch?v=abc" };
  const prisma = createPrismaHarness(restrictedVideo);
  const result = await createOrRegenerateCapsule({
    prisma,
    userId: "user-1",
    videoId: "video-1",
    input: { sourceText: "", analysisMode: "auto", forceRegenerate: false },
    generator: async ({ source }) => normalizeCapsuleResult({
      summary: "Resumo conservador dos metadados.",
      aiConfidence: 0.3,
    }, { coverage: source.coverage, sourceDescription: source.sourceDescription, aiModel: "test" }),
  });
  assert.equal(result.capsule.coverage, "metadata_only");
  assert.equal(result.capsule.status, "limited");
});

function createPrismaHarness(ownedVideo) {
  let capsule = null;
  return {
    video: { findFirst: async ({ where }) => where.id === ownedVideo.id && where.userId === ownedVideo.userId ? ownedVideo : null },
    contentCapsule: {
      findFirst: async () => capsule,
      upsert: async ({ create, update }) => {
        capsule = capsule
          ? { ...capsule, ...update, updatedAt: new Date() }
          : { id: "capsule-1", ...create, createdAt: new Date(), updatedAt: new Date() };
        return capsule;
      },
      update: async ({ data }) => {
        capsule = { ...capsule, ...data, updatedAt: new Date() };
        return capsule;
      },
    },
  };
}
