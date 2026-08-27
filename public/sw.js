const CACHE_NAME = 'guardei-v4';
const META_CACHE = 'guardei-meta-v1';
const PERIODIC_TAG = 'guardei-smart-reminders-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/guardei-icon.png',
  '/icons/guardei-icon-transparent.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => key.startsWith('guardei-v') && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'SHOW_SMART_NOTIFICATION') return;
  const payload = event.data.payload || {};
  event.waitUntil(showSmartNotification(payload));
});

self.addEventListener('periodicsync', event => {
  if (event.tag !== PERIODIC_TAG) return;
  event.waitUntil(runPeriodicSmartReminder());
});

self.addEventListener('notificationclick', event => {
  const data = event.notification?.data || {};
  const action = event.action;
  event.notification.close();

  if (action === 'seen' && data.videoId) {
    event.waitUntil(markVideoSeenAndOpen(data.videoId));
    return;
  }

  if (action === 'open-link' && data.url) {
    event.waitUntil(self.clients.openWindow(data.url));
    return;
  }

  event.waitUntil(focusOrOpenApp(data.videoId));
});

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put('/index.html', response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) || (await caches.match('/index.html'));
  }
}

async function showSmartNotification(payload) {
  if (!payload.title || !payload.body) return;
  await self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: '/icons/guardei-icon.png',
    badge: '/icons/guardei-icon-transparent.png',
    tag: payload.videoId ? `guardei-smart-${payload.videoId}` : 'guardei-smart-reminder',
    renotify: false,
    requireInteraction: false,
    data: {
      videoId: payload.videoId || null,
      url: payload.url || null,
      appUrl: payload.videoId ? `/?smart-nudge=${encodeURIComponent(payload.videoId)}` : '/'
    },
    actions: [
      { action: 'open-link', title: 'Abrir link' },
      { action: 'seen', title: 'Já vi' }
    ]
  });
}

async function runPeriodicSmartReminder() {
  if (!(await canSendPeriodicReminder())) return;

  try {
    const response = await fetch('/api/videos', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include'
    });
    if (!response.ok) return;

    const videos = await response.json();
    const candidate = pickBackgroundCandidate(Array.isArray(videos) ? videos : []);
    if (!candidate) return;

    const copy = buildBackgroundCopy(candidate);
    await showSmartNotification({
      ...copy,
      videoId: candidate.id,
      url: candidate.url
    });
    await writeLastPeriodicReminder(Date.now());
  } catch {
    // Background reminders are best-effort. The in-app engine remains the fallback.
  }
}

function pickBackgroundCandidate(videos) {
  const now = Date.now();
  return videos
    .filter(video => video?.url && !['arquivado', 'aplicado'].includes(video.status))
    .map(video => {
      const reference = new Date(video.reviewedAt || video.createdAt || 0).getTime();
      const ageDays = Number.isFinite(reference) ? Math.max(0, (now - reference) / 86400000) : 0;
      let score = Math.min(18, ageDays * .5);
      score += { alta: 11, media: 6, baixa: 2 }[video.priority] || 2;
      score += { importante: 12, rever: 8, novo: 5, inbox: 3 }[video.status] || 1;
      score -= Math.min(6, Number(video.reviewCount || 0) * 1.2);
      return { video, score, ageDays };
    })
    .filter(item => item.ageDays >= 7)
    .sort((a, b) => b.score - a.score)[0]?.video || null;
}

function buildBackgroundCopy(video) {
  const now = Date.now();
  const reference = new Date(video.reviewedAt || video.createdAt || now).getTime();
  const ageDays = Math.max(0, Math.floor((now - reference) / 86400000));
  const title = truncate(video.titleCustom || video.titleAi || video.titleOriginal || 'esse link', 58);

  if (video.status === 'importante' || video.priority === 'alta') {
    return {
      title: '⭐ Importante, lembra?',
      body: `“${title}” está há ${ageDays} dias esperando o tratamento VIP que você prometeu.`
    };
  }
  if (ageDays >= 45) {
    return {
      title: '🗿 Achado arqueológico',
      body: `“${title}” está guardado há ${ageDays} dias. Isso é acervo ou sítio histórico?`
    };
  }
  if (ageDays >= 21) {
    return {
      title: '🫣 A gente precisa falar sobre isso',
      body: `Faz ${ageDays} dias que você salvou “${title}”. Eu finjo que não vi ou você abre?`
    };
  }
  return {
    title: '👀 Uma semana depois…',
    body: `Você salvou “${title}” e nunca mais voltou. Coincidência? O Guardinho acha que não.`
  };
}

async function canSendPeriodicReminder() {
  const cache = await caches.open(META_CACHE);
  const key = new Request(`${self.location.origin}/__guardei-meta/last-periodic-reminder`);
  const response = await cache.match(key);
  if (!response) return true;
  const lastAt = Number(await response.text());
  return !Number.isFinite(lastAt) || Date.now() - lastAt >= 20 * 60 * 60 * 1000;
}

async function writeLastPeriodicReminder(timestamp) {
  const cache = await caches.open(META_CACHE);
  const key = new Request(`${self.location.origin}/__guardei-meta/last-periodic-reminder`);
  await cache.put(key, new Response(String(timestamp), { headers: { 'Content-Type': 'text/plain' } }));
}

async function markVideoSeenAndOpen(videoId) {
  try {
    await fetch(`/api/videos/${encodeURIComponent(videoId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        status: 'aplicado',
        watchedAt: new Date().toISOString(),
        reviewedAt: new Date().toISOString(),
        watchCount: 1,
        watchedSeconds: 300
      })
    });
  } catch {
    // If the API is unavailable, opening the app still lets the user update manually.
  }
  await focusOrOpenApp(videoId);
}

async function focusOrOpenApp(videoId) {
  const appUrl = videoId ? `/?smart-nudge=${encodeURIComponent(videoId)}` : '/';
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
  if (existing) {
    await existing.focus();
    if ('navigate' in existing) await existing.navigate(appUrl);
    return;
  }
  await self.clients.openWindow(appUrl);
}

function truncate(value, maxLength) {
  const text = String(value || '').trim();
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trim()}…`;
}
