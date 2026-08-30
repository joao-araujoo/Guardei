import { createHash } from "node:crypto";
import { buildMetadataText, normalizeUserSourceText, sanitizeAndExtractText } from "./contentSanitizer.js";
import { fetchTextWithRedirects } from "../security/urlSafety.js";

const RESTRICTED_PLATFORM_HOSTS = [
  "youtube.com", "youtu.be", "tiktok.com", "instagram.com", "twitter.com", "x.com",
  "spotify.com", "netflix.com", "facebook.com", "threads.net",
];

export async function extractCapsuleSource({ video, sourceText, analysisMode = "auto", fetcher = fetchTextWithRedirects }) {
  const manual = normalizeUserSourceText(sourceText);
  if (manual.text) {
    return buildResult({
      coverage: "user_content",
      sourceText: manual.text,
      truncated: manual.truncated,
      sourceDescription: "Texto ou transcricao fornecida pelo usuario.",
    });
  }

  const metadata = buildMetadataText(video);
  if (analysisMode === "metadata_only" || isRestrictedPlatform(video.url)) {
    return buildResult({
      coverage: "metadata_only",
      sourceText: metadata,
      truncated: false,
      sourceDescription: "Titulo, descricao, autor, tags, notas e demais metadados disponiveis.",
    });
  }

  try {
    const downloaded = await fetcher(video.url);
    const extracted = sanitizeAndExtractText(downloaded.body, downloaded.contentType);
    if (!extracted.text || extracted.text.length < 160) {
      return buildResult({
        coverage: "metadata_only",
        sourceText: metadata,
        truncated: false,
        sourceDescription: "O texto publico nao estava disponivel; a analise usou somente metadados.",
      });
    }

    const combined = [extracted.text, metadata ? `\n\nMetadados do item:\n${metadata}` : ""].join("").trim();
    return buildResult({
      coverage: downloaded.truncated || extracted.truncated ? "partial_content" : "full_content",
      sourceText: combined,
      truncated: downloaded.truncated || extracted.truncated,
      sourceDescription: downloaded.truncated || extracted.truncated
        ? "Apenas parte do texto publico pode ser obtida com seguranca."
        : "Texto publico obtido e normalizado sem executar scripts.",
      finalUrl: downloaded.finalUrl,
    });
  } catch (error) {
    return buildResult({
      coverage: "metadata_only",
      sourceText: metadata,
      truncated: false,
      sourceDescription: "Nao foi possivel acessar o conteudo com seguranca; a analise usou somente metadados.",
      extractionErrorCode: safeExtractionCode(error),
    });
  }
}

export function isRestrictedPlatform(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    return RESTRICTED_PLATFORM_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function buildResult({ coverage, sourceText, truncated, sourceDescription, finalUrl = null, extractionErrorCode = null }) {
  const normalized = String(sourceText || "").trim();
  return {
    coverage,
    sourceText: normalized,
    sourceTextHash: createHash("sha256").update(normalized).digest("hex"),
    truncated,
    sourceDescription,
    finalUrl,
    extractionErrorCode,
  };
}

function safeExtractionCode(error) {
  const allowed = new Set([
    "INVALID_URL", "INVALID_PROTOCOL", "URL_CREDENTIALS_BLOCKED", "PORT_BLOCKED", "PRIVATE_HOST_BLOCKED",
    "PRIVATE_IP_BLOCKED", "DNS_LOOKUP_FAILED", "TOO_MANY_REDIRECTS", "INVALID_REDIRECT",
    "CONTENT_TYPE_BLOCKED", "REMOTE_HTTP_ERROR", "REMOTE_TIMEOUT",
  ]);
  return allowed.has(error?.code) ? error.code : "CONTENT_UNAVAILABLE";
}
