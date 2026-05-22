export function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function extractTikTokUrl(input = '') {
  const text = String(input || '').trim();
  if (!text) return '';

  const matches = text.match(/https?:\/\/[^\s)]+/gi) || [];
  const tiktok = matches.find(url => /tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com/i.test(url));
  return cleanUrl(tiktok || (isLikelyTikTokUrl(text) ? text : ''));
}

export function extractSupportedVideoUrl(input = '') {
  const text = String(input || '').trim();
  if (!text) return '';

  const matches = text.match(/https?:\/\/[^\s)]+/gi) || [];
  const supported = matches.find(url => isSupportedVideoUrl(url));
  return cleanUrl(supported || (isSupportedVideoUrl(text) ? text : ''));
}

export function isLikelyTikTokUrl(value = '') {
  return /^(https?:\/\/)?([^\s.]+\.)?(tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)/i.test(value.trim());
}

export function isLikelyYouTubeUrl(value = '') {
  return /^(https?:\/\/)?([^\s.]+\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)/i.test(value.trim());
}

export function isSupportedVideoUrl(value = '') {
  return isLikelyTikTokUrl(value) || isLikelyYouTubeUrl(value) || isLikelyWebUrl(value);
}

export function detectVideoPlatform(url = '') {
  if (isLikelyTikTokUrl(url)) return 'tiktok';
  if (isLikelyYouTubeUrl(url)) return 'youtube';
  const hostname = getHostname(url);
  if (/twitter\.com|x\.com$/i.test(hostname)) return 'twitter';
  if (/instagram\.com$/i.test(hostname)) return 'instagram';
  if (/spotify\.com$/i.test(hostname)) return 'spotify';
  if (/pinterest\.com$/i.test(hostname)) return 'pinterest';
  if (/reddit\.com$/i.test(hostname)) return 'reddit';
  if (/linkedin\.com$/i.test(hostname)) return 'linkedin';
  if (/substack\.com$/i.test(hostname)) return 'substack';
  if (/medium\.com$/i.test(hostname)) return 'medium';
  if (/github\.com$/i.test(hostname)) return 'github';
  if (/netflix\.com$/i.test(hostname)) return 'netflix';
  if (/twitch\.tv$/i.test(hostname)) return 'twitch';
  return 'web';
}

export function isLikelyWebUrl(value = '') {
  return /^(https?:\/\/)?[^\s]+\.[^\s]{2,}/i.test(value.trim());
}

export function getHostname(url = '') {
  try {
    return new URL(cleanUrl(url)).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

export function cleanUrl(url = '') {
  let clean = String(url || '').trim();
  clean = clean.replace(/[),.;!?]+$/g, '');
  if (clean && !/^https?:\/\//i.test(clean)) clean = `https://${clean}`;
  return clean;
}

export function extractHashtags(text = '') {
  const tags = String(text || '').match(/#[\p{L}\p{N}_-]+/giu) || [];
  return [...new Set(tags.map(tag => tag.replace('#', '').toLowerCase()))].slice(0, 12);
}

export function extractCreator(text = '', url = '') {
  const source = `${text} ${url}`;
  const at = source.match(/@([a-zA-Z0-9._-]{2,32})/);
  return at ? `@${at[1]}` : '';
}

export function extractTikTokId(url = '') {
  const match = String(url).match(/\/video\/(\d+)/);
  if (match?.[1]) return match[1];
  try {
    const parsed = new URL(url);
    return parsed.pathname.split('/').filter(Boolean).slice(-1)[0] || '';
  } catch {
    return '';
  }
}

export function extractYouTubeId(url = '') {
  try {
    const parsed = new URL(cleanUrl(url));
    if (/youtu\.be$/i.test(parsed.hostname)) return parsed.pathname.split('/').filter(Boolean)[0] || '';
    if (parsed.searchParams.get('v')) return parsed.searchParams.get('v') || '';
    const parts = parsed.pathname.split('/').filter(Boolean);
    const marker = ['shorts', 'embed', 'live'].find(item => parts.includes(item));
    if (marker) return parts[parts.indexOf(marker) + 1] || '';
    return '';
  } catch {
    return '';
  }
}

export function extractVideoId(url = '') {
  const platform = detectVideoPlatform(url);
  if (platform === 'youtube') return extractYouTubeId(url);
  if (platform === 'tiktok') return extractTikTokId(url);
  return '';
}

export function sanitizeSharedTitle({ title = '', text = '', url = '' }) {
  const raw = [title, text].filter(Boolean).join(' ');
  let cleaned = raw
    .replace(/https?:\/\/[^\s)]+/gi, ' ')
    .replace(/#\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/TikTok/gi, '')
    .replace(/Assista|Watch|Veja|Ver mais|original sound/gi, '')
    .trim();

  if (!cleaned && url) cleaned = `Link de ${detectVideoPlatform(url)}`;
  if (cleaned.length > 88) cleaned = `${cleaned.slice(0, 85).trim()}...`;
  return cleaned;
}

export function createThumbnailFallback(category) {
  return category?.gradient || 'linear-gradient(135deg,#11111d,#25253a,#8b8ba740)';
}

export function getSharePayloadFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

  const payload = {
    isShareTarget: params.has('share-target') || hashParams.has('share-target'),
    title: params.get('title') || hashParams.get('title') || '',
    text: params.get('text') || hashParams.get('text') || '',
    url: params.get('url') || hashParams.get('url') || ''
  };

  const combined = [payload.url, payload.text, payload.title].join(' ');
  payload.url = extractSupportedVideoUrl(combined);
  payload.sourceText = [payload.title, payload.text].filter(Boolean).join(' ').trim();
  return payload;
}
