const baseUrl = () => (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_VAULT_API_URL || window.VAULT_API_URL || '').replace(/\/$/, '');

export async function searchLibrary(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') query.set(key, String(value));
  });
  return request(`/api/search?${query.toString()}`);
}

export async function reindexVideo(videoId) {
  return request(`/api/search/reindex/${encodeURIComponent(videoId)}`, { method: 'POST' });
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl()}${path}`, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || 'Não foi possível concluir a busca.');
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  return data;
}
