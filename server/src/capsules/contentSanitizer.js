export const MAX_SOURCE_TEXT_CHARS = 80_000;

export function sanitizeAndExtractText(input, contentType = "text/html") {
  const source = String(input || "");
  if (!source) return { text: "", truncated: false };

  const text = contentType.includes("html")
    ? htmlToText(source)
    : normalizeText(contentType === "application/json" ? jsonToText(source) : source);
  return limitText(text, MAX_SOURCE_TEXT_CHARS);
}

export function normalizeUserSourceText(value) {
  return limitText(normalizeText(String(value || "")), MAX_SOURCE_TEXT_CHARS);
}

export function buildMetadataText(video) {
  return normalizeText(
    [
      video.titleCustom || video.titleAi || video.titleOriginal,
      video.description,
      video.authorName ? `Autor: ${video.authorName}` : "",
      video.providerName ? `Fonte: ${video.providerName}` : "",
      video.category ? `Categoria: ${video.category}` : "",
      video.tags?.length ? `Tags: ${video.tags.join(", ")}` : "",
      video.note ? `Nota do usuario: ${video.note}` : "",
      video.summary,
      video.url ? `URL: ${video.url}` : "",
    ].filter(Boolean).join("\n"),
  );
}

function htmlToText(html) {
  let clean = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|canvas|iframe|object|embed|form|button|nav|header|footer|aside)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(meta|link|input|source|picture)[^>]*>/gi, " ");

  const article = firstBlock(clean, "article") || firstBlock(clean, "main") || firstBlock(clean, "body") || clean;
  clean = article
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|section|article|main|h[1-6]|li|blockquote|pre|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return normalizeText(decodeEntities(clean));
}

function firstBlock(html, tag) {
  return html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] || "";
}

function jsonToText(source) {
  try {
    return flattenJson(JSON.parse(source)).join("\n");
  } catch {
    return source;
  }
}

function flattenJson(value, output = [], depth = 0) {
  if (depth > 5 || output.join(" ").length > MAX_SOURCE_TEXT_CHARS) return output;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") output.push(String(value));
  else if (Array.isArray(value)) value.slice(0, 100).forEach((item) => flattenJson(item, output, depth + 1));
  else if (value && typeof value === "object") Object.values(value).slice(0, 100).forEach((item) => flattenJson(item, output, depth + 1));
  return output;
}

function decodeEntities(value) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_match, entity) => {
    if (entity[0] === "#") {
      const hex = entity[1]?.toLowerCase() === "x";
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : " ";
    }
    return named[entity.toLowerCase()] ?? " ";
  });
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function limitText(text, maxChars) {
  if (text.length <= maxChars) return { text, truncated: false };
  return { text: text.slice(0, maxChars).trim(), truncated: true };
}
