import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildSharedImportData, PUBLIC_SHARED_VIDEO_SELECT, sharedTitle } from "../src/collections/publicCollection.js";

const privateFields = [
  "note",
  "description",
  "sourceText",
  "aiRationale",
  "applicationNote",
  "applicationEvidenceUrl",
  "mood",
  "effort",
  "durationBucket",
  "bestFor",
  "watchWhen",
  "priority",
  "canonicalUrl",
  "authorName",
  "authorUrl",
];

test("public collection query allowlist excludes private video fields", () => {
  for (const field of privateFields) {
    assert.equal(PUBLIC_SHARED_VIDEO_SELECT[field], undefined, `${field} must not be queried by the public collection path`);
  }
  for (const field of ["id", "url", "platform", "thumbnailUrl", "category", "tags", "summary", "savedFor"]) {
    assert.equal(PUBLIC_SHARED_VIDEO_SELECT[field], true, `${field} should remain public`);
  }
});

test("shared imports only carry data visible through the public collection", () => {
  const source = {
    id: "video-1",
    url: "https://example.com/public",
    canonicalUrl: "https://private.example/internal-canonical",
    platform: "web",
    titleOriginal: "Original",
    titleAi: "AI title",
    titleCustom: "Public title",
    thumbnailUrl: "https://example.com/thumb.jpg",
    category: "design",
    tags: ["ui", "referencia"],
    summary: "Resumo publico",
    savedFor: "inspirar",
    note: "NOTA PRIVADA",
    description: "TEXTO PRIVADO COMPLETO",
    sourceText: "OCR OU PENSAMENTO PRIVADO",
    aiRationale: "RACIONAL PRIVADO",
    applicationNote: "APLICACAO PRIVADA",
    applicationEvidenceUrl: "https://private.example/evidence",
    mood: "privado",
    effort: "privado",
    durationBucket: "privado",
    bestFor: "privado",
    watchWhen: "privado",
    priority: "alta",
    authorName: "Privado",
    authorUrl: "https://private.example/author",
  };

  const data = buildSharedImportData({ note: "Nota explicitamente publica da colecao", video: source }, "recipient");

  assert.equal(data.userId, "recipient");
  assert.equal(data.url, source.url);
  assert.equal(data.canonicalUrl, source.url);
  assert.equal(data.titleAi, "Public title");
  assert.equal(data.titleOriginal, "Public title");
  assert.equal(data.category, "design");
  assert.deepEqual(data.tags, ["ui", "referencia"]);
  assert.equal(data.summary, "Resumo publico");
  assert.equal(data.savedFor, "inspirar");
  assert.equal(data.note, "Nota explicitamente publica da colecao");

  for (const field of privateFields.filter(field => field !== "note" && field !== "canonicalUrl" && field !== "priority")) {
    assert.equal(Object.hasOwn(data, field), false, `${field} must never be copied from a public collection`);
  }
  assert.equal(Object.hasOwn(data, "priority"), false);
});

test("source private note is never used as a fallback during import", () => {
  const data = buildSharedImportData({ note: null, video: { url: "https://example.com", titleAi: "X", platform: "web", category: "misc", tags: [], note: "segredo" } }, "recipient");
  assert.equal(data.note, null);
});

test("invalid or legacy shared intent is normalized without exposing hidden reason", () => {
  const data = buildSharedImportData({ video: { url: "https://example.com", titleAi: "X", platform: "web", category: "misc", tags: [], savedFor: "legacy-secret-reason" } }, "recipient");
  assert.equal(data.savedFor, "guardar");
  assert.equal(data.reason, "guardar");
});

test("public title collapses internal title variants into the single visible value", () => {
  assert.equal(sharedTitle({ titleOriginal: "Original", titleAi: "AI", titleCustom: "Custom" }), "Custom");
  assert.equal(sharedTitle({ titleOriginal: "Original", titleAi: "AI" }), "AI");
  assert.equal(sharedTitle({ titleOriginal: "Original" }), "Original");
});

test("public routes are wired to the allowlist and sanitized import builder", async () => {
  const routes = await readFile(new URL("../src/routes/collectionRoutes.js", import.meta.url), "utf8");
  assert.match(routes, /video:\s*\{\s*select:\s*PUBLIC_SHARED_VIDEO_SELECT\s*\}/);
  assert.match(routes, /data:\s*buildSharedImportData\(entry,\s*req\.user\.id\)/);
  assert.doesNotMatch(routes, /entry\.note\s*\|\|\s*source\.note/);
  assert.doesNotMatch(routes, /description:\s*source\.description/);
  assert.doesNotMatch(routes, /sourceText:\s*source\.sourceText/);
});
