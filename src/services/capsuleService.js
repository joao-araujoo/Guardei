const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_VAULT_API_URL || window.VAULT_API_URL || '').replace(/\/$/, '');

export function getCapsule(videoId) {
  return request(`/api/videos/${encodeURIComponent(videoId)}/capsule`);
}

export function createCapsule(videoId, payload = {}) {
  return request(`/api/videos/${encodeURIComponent(videoId)}/capsule`, { method: 'POST', body: payload });
}

export function regenerateCapsule(videoId, payload = {}) {
  return request(`/api/videos/${encodeURIComponent(videoId)}/capsule/regenerate`, { method: 'POST', body: { ...payload, forceRegenerate: true } });
}

export function deleteCapsule(videoId) {
  return request(`/api/videos/${encodeURIComponent(videoId)}/capsule`, { method: 'DELETE' });
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs || 45_000);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const error = new Error(payload?.message || 'Não foi possível processar a cápsula.');
      error.status = response.status;
      error.code = payload?.code;
      error.payload = payload;
      throw error;
    }
    return response.status === 204 ? null : response.json();
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('A análise excedeu o tempo limite. Tente novamente.');
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
