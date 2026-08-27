const CACHE_NAME = 'guardei-v5';
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
  event.waitUntil(showSmartNotification(event.data.payload || {}));
});

self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data?.json?.() || {};
  } catch {
    payload = { title: '👀 O Guardinho lembrou de você', body: event.data?.text?.() || 'Tem coisa boa criando poeira no seu acervo.' };
  }
  event.waitUntil(showSmartNotification(payload));
});

self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil(refreshPushSubscription());
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

  event.waitUntil(focusOrOpenApp(data.videoId, data.appUrl));
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
  const title = payload.title || '👀 O Guardinho lembrou de você';
  const body = payload.body || 'Tem coisa boa criando poeira no seu acervo.';
  const actions = Array.isArray(payload.actions) && payload.actions.length
    ? payload.actions.slice(0, 2)
    : [
        { action: 'open-link', title: 'Abrir link' },
        { action: 'seen', title: 'Já vi' }
      ];

  await self.registration.showNotification(title, {
    body,
    icon: payload.icon || '/icons/guardei-icon.png',
    badge: payload.badge || '/icons/guardei-icon-transparent.png',
    tag: payload.tag || (payload.videoId ? `guardei-smart-${payload.videoId}` : 'guardei-smart-reminder'),
    renotify: false,
    requireInteraction: false,
    data: {
      videoId: payload.videoId || null,
      url: payload.url || null,
      appUrl: payload.appUrl || (payload.videoId ? `/?smart-nudge=${encodeURIComponent(payload.videoId)}` : '/')
    },
    actions
  });
}

async function refreshPushSubscription() {
  try {
    const response = await fetch('/api/push/public-key', { credentials: 'include', headers: { Accept: 'application/json' } });
    if (!response.ok) return;
    const config = await response.json();
    if (!config?.enabled || !config.publicKey) return;

    const subscription = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.publicKey)
    });

    await fetch('/api/push/subscribe', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: subscription.toJSON(), userAgent: 'service-worker-refresh' })
    });

    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(client => client.postMessage({ type: 'PUSH_SUBSCRIPTION_REFRESH' }));
  } catch {
    // The foreground bootstrap will retry on the next app open/focus.
  }
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
    await showSmartNotification({ ...copy, videoId: candidate.id, url: candidate.url });
    await writeLastPeriodicReminder(Date.now());
  } catch {
    // Server-driven Web Push is the primary background path; this remains a progressive fallback.
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
    return { title: '⭐ Importante, lembra?', body: `“${title}” está há ${ageDays} dias esperando o tratamento VIP que você prometeu.` };
  }
  if (ageDays >= 45) {
    return { title: '🗿 Achado arqueológico', body: `“${title}” está guardado há ${ageDays} dias. Isso é acervo ou sítio histórico?` };
  }
  if (ageDays >= 21) {
    return { title: '🫣 A gente precisa falar sobre isso', body: `Faz ${ageDays} dias que você salvou “${title}”. Eu finjo que não vi ou você abre?` };
  }
  return { title: '👀 Uma semana depois…', body: `Você salvou “${title}” e nunca mais voltou. Coincidência? O Guardinho acha que não.` };
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
    const now = new Date().toISOString();
    await fetch(`/api/videos/${encodeURIComponent(videoId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'aplicado', watchedAt: now, reviewedAt: now })
    });
  } catch {
    // Opening the app still lets the user update manually if the API is unavailable.
  }
  await focusOrOpenApp(videoId);
}

async function focusOrOpenApp(videoId, explicitAppUrl = '') {
  const appUrl = explicitAppUrl || (videoId ? `/?smart-nudge=${encodeURIComponent(videoId)}` : '/');
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
  if (existing) {
    await existing.focus();
    if ('navigate' in existing) await existing.navigate(appUrl);
    return;
  }
  await self.clients.openWindow(appUrl);
}

function urlBase64ToUint8Array(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
}

function truncate(value, maxLength) {
  const text = String(value || '').trim();
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trim()}…`;
}
