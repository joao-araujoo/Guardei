const baseUrl = () => (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_VAULT_API_URL || window.VAULT_API_URL || '').replace(/\/$/, '');

export async function getRelatedItems(videoId, limit = 6) {
  return request(`/api/videos/${encodeURIComponent(videoId)}/related?limit=${Math.min(12, limit)}`);
}

export async function getKnowledgeMap(filters = {}) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== 'all') query.set(key, String(value));
  });
  return request(`/api/connections/map?${query.toString()}`);
}

async function request(path) {
  const response = await fetch(`${baseUrl()}${path}`, { credentials: 'include' });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || 'Não foi possível carregar as conexões.');
  return data;
}
