import assert from "node:assert/strict";
import test from "node:test";
import { analyzeScreenshot, hasValidImageSignature } from "../src/everywhere/visionService.js";

test("recognizes PNG, JPEG and WebP binary signatures", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const webp = Buffer.from("RIFFxxxxWEBP", "ascii");

  assert.equal(hasValidImageSignature(png, "image/png"), true);
  assert.equal(hasValidImageSignature(jpeg, "image/jpeg"), true);
  assert.equal(hasValidImageSignature(webp, "image/webp"), true);
});

test("rejects MIME labels that do not match the binary content", async () => {
  const arbitrary = Buffer.from("not an image", "utf8").toString("base64");

  await assert.rejects(
    analyzeScreenshot(`data:image/png;base64,${arbitrary}`, { enableAi: false }),
    error => error?.status === 400 && error?.code === "INVALID_IMAGE" && /formato de imagem/i.test(error.message),
  );
});

test("does not accept one image signature under another MIME type", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

  assert.equal(hasValidImageSignature(png, "image/jpeg"), false);
  assert.equal(hasValidImageSignature(jpeg, "image/png"), false);
  assert.equal(hasValidImageSignature(Buffer.from("RIFFxxxxNOPE", "ascii"), "image/webp"), false);
});

test("keeps valid PNG captures usable without invoking AI", async () => {
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const result = await analyzeScreenshot(`data:image/png;base64,${pngHeader.toString("base64")}`, { enableAi: false });

  assert.equal(result.image.mimeType, "image/png");
  assert.equal(result.image.bytes, pngHeader.length);
  assert.equal(result.title, "Screenshot salvo");
});
