export const PUBLIC_SHARED_VIDEO_SELECT = Object.freeze({
  id: true,
  url: true,
  platform: true,
  titleOriginal: true,
  titleAi: true,
  titleCustom: true,
  thumbnailUrl: true,
  category: true,
  tags: true,
  summary: true,
  savedFor: true,
});

const SHARED_INTENTS = new Set(["ver-depois", "aprender", "aplicar", "inspirar", "comprar", "refletir", "guardar"]);

export function buildSharedImportData(entry, userId) {
  const source = entry?.video || {};
  const title = sharedTitle(source);
  const savedFor = normalizeSharedIntent(source.savedFor);

  return {
    userId,
    url: source.url,
    canonicalUrl: source.url,
    platform: source.platform || "web",
    titleOriginal: title,
    titleAi: title,
    thumbnailUrl: source.thumbnailUrl || null,
    category: source.category || "misc",
    reason: savedFor === "ver-depois" ? "guardar" : savedFor,
    savedFor,
    tags: Array.isArray(source.tags) ? source.tags.slice(0, 12) : [],
    status: "inbox",
    note: entry?.note || null,
    summary: source.summary || null,
    origin: "shared-collection",
    schemaVersion: 4,
  };
}

export function sharedTitle(video) {
  return video?.titleCustom || video?.titleAi || video?.titleOriginal || "Item compartilhado";
}

function normalizeSharedIntent(value) {
  return SHARED_INTENTS.has(value) ? value : "guardar";
}
