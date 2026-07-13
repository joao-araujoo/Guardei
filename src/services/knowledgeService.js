const baseUrl = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_VAULT_API_URL || window.VAULT_API_URL || '').replace(/\/$/, '');

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  if (!response.ok) {
    let payload = null;
    try { payload = await response.json(); } catch {}
    const error = new Error(payload?.message || 'Não foi possível concluir a ação.');
    error.status = response.status;
    error.code = payload?.code;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

export const knowledgeService = {
  today: () => request('/api/reviews/today'),
  session: minutes => request(`/api/reviews/session?minutes=${encodeURIComponent(minutes)}`),
  dashboard: (days = 30) => request(`/api/knowledge/dashboard?days=${days}`),
  reflection: videoId => request(`/api/videos/${videoId}/reflection`),
  saveReflection: (videoId, body) => request(`/api/videos/${videoId}/reflection`, { method: 'POST', body }),
  cards: params => request(`/api/cards?${new URLSearchParams(Object.entries(params || {}).filter(([, value]) => value !== undefined && value !== '')).toString()}`),
  generateCards: (videoId, limit = 3) => request(`/api/videos/${videoId}/cards/generate`, { method: 'POST', body: { limit } }),
  createCard: body => request('/api/cards', { method: 'POST', body }),
  updateCard: (id, body) => request(`/api/cards/${id}`, { method: 'PATCH', body }),
  deleteCard: id => request(`/api/cards/${id}`, { method: 'DELETE' }),
  reviewCard: (id, body) => request(`/api/cards/${id}/review`, { method: 'POST', body }),
  applications: params => request(`/api/applications?${new URLSearchParams(Object.entries(params || {}).filter(([, value]) => value !== undefined && value !== '')).toString()}`),
  createApplication: (videoId, body) => request(`/api/videos/${videoId}/applications`, { method: 'POST', body }),
  updateApplication: (id, body) => request(`/api/applications/${id}`, { method: 'PATCH', body }),
  deleteApplication: id => request(`/api/applications/${id}`, { method: 'DELETE' })
};
