import { CATEGORIES, REASONS, CATEGORY_BY_ID } from './categories.js';
import {
  detectVideoPlatform,
  extractCreator,
  extractHashtags,
  extractVideoId,
  normalizeText,
  sanitizeSharedTitle
} from './tiktok.js';

const PRIORITY_KEYWORDS = ['importante', 'urgente', 'salvar', 'essencial', 'muito bom', 'preciso', 'projeto', 'cliente', 'trabalho', 'faculdade', 'tutorial', 'passo a passo', 'guia', 'roadmap'];
const LIGHT_KEYWORDS = ['leve', 'rapido', 'rapida', 'engracado', 'curioso', 'react', 'meme', 'trend', 'entretenimento', 'basico', 'simples'];
const DEEP_KEYWORDS = ['aula', 'tutorial', 'passo a passo', 'guia', 'explica', 'estrategia', 'roadmap', 'analise', 'curso', 'estudo'];
const TITLE_STOPWORDS = new Set(['para', 'com', 'uma', 'esse', 'essa', 'isso', 'aquele', 'aquela', 'sobre', 'voce', 'você', 'como', 'porque', 'pra', 'pro', 'dos', 'das', 'que', 'tem', 'mais', 'menos', 'tiktok', 'youtube', 'video']);

export async function buildAutoVideo({ url, title = '', text = '', origin = 'manual' }) {
  const platform = detectVideoPlatform(url);
  const apiResult = await tryBackendEnrichment({ url, title, text, platform });
  const local = createLocalEnrichment({
    url,
    title: apiResult?.titleOriginal || title,
    text: [text, apiResult?.description, apiResult?.note].filter(Boolean).join(' '),
    oembed: apiResult
  });

  const merged = {
    ...local,
    ...Object.fromEntries(Object.entries(apiResult || {}).filter(([, value]) => value !== undefined && value !== null && value !== '')),
    ai: apiResult?.ai || local.ai
  };

  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    url,
    canonicalUrl: merged.canonicalUrl || url,
    platform: merged.platform || platform,
    platformLabel: merged.platformLabel || platformLabel(platform),
    videoId: merged.videoId || extractVideoId(url),
    tiktokId: platform === 'tiktok' ? (merged.videoId || extractVideoId(url)) : '',
    titleOriginal: merged.titleOriginal || '',
    titleAi: merged.titleAi,
    titleCustom: '',
    authorName: merged.authorName || extractCreator(text, url),
    thumbnailUrl: merged.thumbnailUrl || '',
    thumbnailFallback: merged.thumbnailFallback,
    category: normalizeCategory(merged.category),
    reason: normalizeReason(merged.reason),
    tags: normalizeTags(merged.tags),
    priority: normalizePriority(merged.priority),
    status: merged.status || 'novo',
    note: merged.note || merged.summary || '',
    summary: merged.summary || merged.note || '',
    mood: merged.mood || 'neutro',
    effort: merged.effort || 'medio',
    durationBucket: merged.durationBucket || defaultDurationBucket(platform, url),
    bestFor: merged.bestFor || buildBestFor(merged),
    watchWhen: merged.watchWhen || buildWatchWhen(merged),
    sourceText: [title, text].filter(Boolean).join(' ').trim(),
    origin,
    reviewCount: 0,
    createdAt: now,
    updatedAt: now,
    reviewedAt: null,
    ai: merged.ai,
    schemaVersion: 3
  };
}

async function tryBackendEnrichment(payload) {
  const configuredBase =
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_VAULT_API_URL ||
    window.VAULT_API_URL ||
    '';
  if (!configuredBase) return null;

  const url = `${configuredBase.replace(/\/$/, '')}/api/ai/enrich-video`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data?.video || data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function createLocalEnrichment({ url, title = '', text = '', oembed = null }) {
  const platform = detectVideoPlatform(url);
  const source = [title, text, oembed?.title, oembed?.titleOriginal, oembed?.authorName].filter(Boolean).join(' ');
  const normalized = normalizeText(source);
  const hashtags = extractHashtags(source);
  const categoryScores = CATEGORIES.map(category => {
    if (category.id === 'misc') return { category, score: 0 };
    const score = category.keywords.reduce((total, keyword) => total + keywordScore(normalized, keyword), 0);
    return { category, score };
  }).sort((a, b) => b.score - a.score);

  const best = categoryScores[0];
  const category = best.score > 0 ? best.category.id : 'misc';
  const reason = detectReason(normalized);
  const titleAi = buildSmartTitle({ rawTitle: oembed?.titleOriginal || oembed?.title || title, text, category, platform });
  const tags = buildTags({ hashtags, normalized, category, platform });
  const priority = detectPriority(normalized, best.score);
  const durationBucket = defaultDurationBucket(platform, url);
  const effort = detectEffort(normalized, durationBucket);
  const mood = detectMood(normalized, effort);
  const categoryMeta = CATEGORY_BY_ID[category];
  const note = buildAutoNote({ category, reason, platform, effort, mood, text: source });

  return {
    canonicalUrl: url,
    platform,
    platformLabel: platformLabel(platform),
    videoId: extractVideoId(url),
    titleOriginal: oembed?.titleOriginal || oembed?.title || title || sanitizeSharedTitle({ title, text, url }),
    titleAi,
    authorName: oembed?.authorName || extractCreator(source, url),
    thumbnailUrl: oembed?.thumbnailUrl || '',
    thumbnailFallback: categoryMeta.gradient,
    category,
    reason,
    tags,
    priority,
    status: best.score > 0 ? 'novo' : 'inbox',
    summary: note,
    note,
    mood,
    effort,
    durationBucket,
    bestFor: buildBestFor({ durationBucket, mood, effort, reason }),
    watchWhen: buildWatchWhen({ durationBucket, mood, effort }),
    ai: {
      engine: 'browser-heuristic',
      confidence: Math.min(0.96, Math.max(0.42, best.score / 6)),
      rationale: best.score > 0 ? `Classificado por palavras-chave de ${categoryMeta.label}.` : 'Sem texto suficiente; enviado para Inbox.'
    }
  };
}

function keywordScore(text, keyword) {
  const key = normalizeText(keyword);
  if (!key) return 0;
  if (text.includes(key)) return key.length > 7 ? 2 : 1;
  return 0;
}

function detectReason(normalized) {
  const best = REASONS.map(reason => ({
    reason,
    score: reason.keywords.reduce((total, keyword) => total + keywordScore(normalized, keyword), 0)
  })).sort((a, b) => b.score - a.score)[0];

  return best?.score > 0 ? best.reason.id : 'guardar';
}

function detectPriority(normalized, categoryScore) {
  const priorityScore = PRIORITY_KEYWORDS.reduce((total, keyword) => total + keywordScore(normalized, keyword), 0);
  if (priorityScore >= 2 || categoryScore >= 5) return 'alta';
  if (priorityScore === 1 || categoryScore >= 2) return 'media';
  return 'baixa';
}

function detectEffort(normalized, durationBucket) {
  const deepScore = DEEP_KEYWORDS.reduce((total, keyword) => total + keywordScore(normalized, keyword), 0);
  const lightScore = LIGHT_KEYWORDS.reduce((total, keyword) => total + keywordScore(normalized, keyword), 0);
  if (durationBucket === 'long' || deepScore >= 2) return 'alto';
  if (lightScore >= 1 || durationBucket === 'short') return 'baixo';
  return 'medio';
}

function detectMood(normalized, effort) {
  if (['engracado', 'meme', 'trend', 'curioso', 'leve', 'basico', 'simples'].some(word => normalized.includes(word))) return 'leve';
  if (['foco', 'estudo', 'trabalho', 'projeto', 'tutorial', 'aula'].some(word => normalized.includes(word))) return 'focado';
  if (['inspiracao', 'ideia', 'criativo', 'design', 'referencia'].some(word => normalized.includes(word))) return 'criativo';
  return effort === 'baixo' ? 'leve' : 'neutro';
}

function buildSmartTitle({ rawTitle = '', text = '', category, platform }) {
  const cleaned = sanitizeSharedTitle({ title: rawTitle, text });
  if (cleaned && !['Video do TikTok', 'Video do YouTube', 'Link de web'].includes(cleaned)) return capitalizeTitle(cleaned);

  const hashtags = extractHashtags(text);
  if (hashtags.length) {
    return capitalizeTitle(hashtags.slice(0, 3).map(tag => tag.replace(/[-_]/g, ' ')).join(' · '));
  }

  const categoryMeta = CATEGORY_BY_ID[category] || CATEGORY_BY_ID.misc;
  return `${categoryMeta.emoji} ${platformLabel(platform)} salvo para revisar`;
}

function buildTags({ hashtags, normalized, category, platform }) {
  const categoryMeta = CATEGORY_BY_ID[category] || CATEGORY_BY_ID.misc;
  const matched = categoryMeta.keywords
    .filter(keyword => keywordScore(normalized, keyword) > 0)
    .map(keyword => normalizeText(keyword).replace(/\s+/g, '-'));

  const meaningfulWords = normalized
    .split(/[^a-z0-9]+/i)
    .filter(word => word.length > 3 && !TITLE_STOPWORDS.has(word))
    .slice(0, 8);

  return [...new Set([platform, ...hashtags, ...matched, ...meaningfulWords])].slice(0, 10);
}

function buildAutoNote({ category, reason, platform, effort, mood, text }) {
  const categoryMeta = CATEGORY_BY_ID[category] || CATEGORY_BY_ID.misc;
  const reasonLabel = REASONS.find(item => item.id === reason)?.label || 'guardar';
  const hint = text && text.length > 20 ? 'Use a legenda/titulo como contexto principal.' : 'Revisar quando abrir para confirmar o valor real.';
  return `${platformLabel(platform)} para ${reasonLabel.toLowerCase()} em ${categoryMeta.label}; melhor quando voce quer algo ${mood} com esforco ${effort}. ${hint}`;
}

function buildBestFor({ durationBucket, mood, effort, reason }) {
  if (effort === 'baixo' || mood === 'leve') return 'Assistir sem pensar muito';
  if (reason === 'aplicar') return 'Transformar em acao ou tarefa';
  if (durationBucket === 'long') return 'Sessao com tempo e foco';
  return 'Revisao rapida com alguma atencao';
}

function buildWatchWhen({ durationBucket, mood, effort }) {
  if (durationBucket === 'short' && (mood === 'leve' || effort === 'baixo')) return 'Quando tiver 2 a 5 minutos livres';
  if (durationBucket === 'medium') return 'Quando tiver 10 a 20 minutos';
  if (durationBucket === 'long') return 'Quando puder sentar e assistir com calma';
  return 'Quando quiser decidir rapido o que vale rever';
}

function defaultDurationBucket(platform, url) {
  if (platform === 'tiktok') return 'short';
  if (platform === 'youtube' && /\/shorts\//i.test(url)) return 'short';
  if (platform === 'youtube') return 'medium';
  if (['spotify', 'twitter', 'instagram', 'reddit'].includes(platform)) return 'short';
  if (['substack', 'medium', 'github', 'linkedin'].includes(platform)) return 'medium';
  return 'unknown';
}

function platformLabel(platform) {
  if (platform === 'youtube') return 'YouTube';
  if (platform === 'tiktok') return 'TikTok';
  if (platform === 'twitter') return 'X/Twitter';
  if (platform === 'spotify') return 'Spotify';
  if (platform === 'instagram') return 'Instagram';
  if (platform === 'reddit') return 'Reddit';
  if (platform === 'pinterest') return 'Pinterest';
  if (platform === 'linkedin') return 'LinkedIn';
  if (platform === 'substack') return 'Substack';
  if (platform === 'medium') return 'Medium';
  if (platform === 'github') return 'GitHub';
  if (platform === 'twitch') return 'Twitch';
  if (platform === 'netflix') return 'Netflix';
  return 'Internet';
}

function normalizeCategory(value) {
  const normalized = normalizeText(value);
  return CATEGORIES.some(category => category.id === normalized) ? normalized : 'misc';
}

function normalizeReason(value) {
  const normalized = normalizeText(value);
  return REASONS.some(reason => reason.id === normalized) ? normalized : 'guardar';
}

function normalizePriority(value) {
  return ['baixa', 'media', 'alta'].includes(value) ? value : 'baixa';
}

function normalizeTags(tags) {
  return Array.isArray(tags) ? [...new Set(tags.map(tag => normalizeText(tag).replace(/\s+/g, '-')).filter(Boolean))].slice(0, 10) : [];
}

function capitalizeTitle(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return 'Video salvo para revisar';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
