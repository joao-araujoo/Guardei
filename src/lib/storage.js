const STORAGE_KEY = 'vault.auto.videos.v2';
const SETTINGS_KEY = 'vault.auto.settings.v2';
const ACHIEVEMENTS_KEY = 'vault.auto.achievements.v2';

export class LocalVaultRepository {
  async listVideos() {
    return safeRead(STORAGE_KEY, []);
  }

  async saveVideos(videos) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
    return videos;
  }

  async addVideo(video) {
    const videos = await this.listVideos();
    const existing = videos.find(item => item.url === video.url || item.canonicalUrl === video.canonicalUrl);
    if (existing) return { video: existing, duplicated: true };
    const next = [video, ...videos];
    await this.saveVideos(next);
    return { video, duplicated: false };
  }

  async updateVideo(id, patch) {
    const videos = await this.listVideos();
    const next = videos.map(video => video.id === id ? { ...video, ...patch, updatedAt: new Date().toISOString() } : video);
    await this.saveVideos(next);
    return next.find(video => video.id === id);
  }

  async deleteVideo(id) {
    const videos = await this.listVideos();
    const next = videos.filter(video => video.id !== id);
    await this.saveVideos(next);
    return true;
  }

  async replaceAll(videos) {
    await this.saveVideos(videos);
    return videos;
  }

  async getSettings() {
    return safeRead(SETTINGS_KEY, {
      dailyReviewTarget: 3,
      autoOpenReviewAfterShare: false,
      storageMode: 'localStorage',
      backendReady: true
    });
  }

  async saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return settings;
  }

  async listAchievements() {
    return safeRead(ACHIEVEMENTS_KEY, []);
  }

  async syncAchievements(achievementIds = []) {
    const existing = await this.listAchievements();
    const byId = new Map(existing.map(item => [item.achievementId, item]));
    achievementIds.forEach(achievementId => {
      if (!byId.has(achievementId)) {
        byId.set(achievementId, { achievementId, unlockedAt: new Date().toISOString() });
      }
    });
    const next = [...byId.values()];
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(next));
    return next;
  }
}

export class ApiVaultRepository {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async listVideos() {
    return this.request('/api/videos');
  }

  async addVideo(video) {
    return this.request('/api/videos', { method: 'POST', body: video });
  }

  async updateVideo(id, patch) {
    return this.request(`/api/videos/${id}`, { method: 'PATCH', body: patch });
  }

  async deleteVideo(id) {
    return this.request(`/api/videos/${id}`, { method: 'DELETE' });
  }

  async replaceAll(videos) {
    return this.request('/api/videos/import', { method: 'POST', body: { videos } });
  }

  async getSettings() {
    return this.request('/api/settings');
  }

  async saveSettings(settings) {
    return this.request('/api/settings', { method: 'PATCH', body: settings });
  }

  async me() {
    return this.request('/api/auth/me');
  }

  async login(credentials) {
    return this.request('/api/auth/login', { method: 'POST', body: credentials });
  }

  async register(payload) {
    return this.request('/api/auth/register', { method: 'POST', body: payload });
  }

  async logout() {
    return this.request('/api/auth/logout', { method: 'POST' });
  }

  async listAchievements() {
    return this.request('/api/achievements');
  }

  async syncAchievements(achievementIds = []) {
    return this.request('/api/achievements/sync', { method: 'POST', body: { achievementIds } });
  }

  async request(path, options = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      const error = new Error(`API error ${response.status}`);
      error.status = response.status;
      try {
        error.payload = await response.json();
      } catch {
        error.payload = null;
      }
      throw error;
    }
    return response.status === 204 ? null : response.json();
  }
}

export function createRepository() {
  const apiUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_VAULT_API_URL || window.VAULT_API_URL || '';
  const mode = import.meta.env.VITE_STORAGE_MODE || window.VAULT_STORAGE_MODE || 'local';
  if (mode === 'api') return new ApiVaultRepository(apiUrl);
  return new LocalVaultRepository();
}

export function exportVault(videos, settings = {}) {
  return {
    app: 'Guardei Acervo IA',
    version: 2,
    exportedAt: new Date().toISOString(),
    settings,
    achievements: safeRead(ACHIEVEMENTS_KEY, []),
    videos
  };
}

export function importVaultPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.videos)) return payload.videos;
  throw new Error('Arquivo de backup inválido.');
}

function safeRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
