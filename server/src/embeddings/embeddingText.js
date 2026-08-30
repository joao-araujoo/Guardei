import crypto from "crypto";

const MAX_TEXT_LENGTH = 6_000;

export function composeEmbeddingText(video = {}) {
  const capsule = video.capsule || {};
  const parts = [
    label("titulo", video.titleCustom || video.titleAi || video.titleOriginal),
    label("descricao", video.description),
    label("nota", video.note),
    label("categoria", video.category),
    label("tags", normalizeList(video.tags).join(", ")),
    label("resumo", video.summary || capsule.summary),
    label("conceitos", normalizeList(capsule.concepts).join(", ")),
    label("pontos principais", normalizeList(capsule.keyPoints).join(" | ")),
  ].filter(Boolean);

  return normalizeText(parts.join("\n")).slice(0, MAX_TEXT_LENGTH);
}

export function hashEmbeddingContent(text) {
  return crypto.createHash("sha256").update(normalizeText(text)).digest("hex");
}

export function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function label(name, value) {
  const clean = normalizeText(value);
  return clean ? `${name}: ${clean}` : "";
}

function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeText).filter(Boolean).slice(0, 12);
}
