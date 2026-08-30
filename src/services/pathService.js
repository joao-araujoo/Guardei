const baseUrl = () => (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_VAULT_API_URL || window.VAULT_API_URL || '').replace(/\/$/, '');

export const pathService = {
  list: () => request('/api/paths'),
  get: id => request(`/api/paths/${id}`),
  create: body => request('/api/paths', { method: 'POST', body }),
  update: (id, body) => request(`/api/paths/${id}`, { method: 'PATCH', body }),
  remove: id => request(`/api/paths/${id}`, { method: 'DELETE' }),
  generate: id => request(`/api/paths/${id}/generate`, { method: 'POST' }),
  reorganize: id => request(`/api/paths/${id}/reorganize`, { method: 'POST' }),
  duplicate: id => request(`/api/paths/${id}/duplicate`, { method: 'POST' }),
  addItem: (id, body) => request(`/api/paths/${id}/items`, { method: 'POST', body }),
  updateItem: (id, itemId, body) => request(`/api/paths/${id}/items/${itemId}`, { method: 'PATCH', body }),
  removeItem: (id, itemId) => request(`/api/paths/${id}/items/${itemId}`, { method: 'DELETE' }),
  reorder: (id, items) => request(`/api/paths/${id}/items/reorder`, { method: 'POST', body: { items } }),
  updateGap: (id, gapId, body) => request(`/api/paths/${id}/gaps/${gapId}`, { method: 'PATCH', body })
};

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl()}${path}`, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || 'Não foi possível atualizar a trilha.');
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  return data;
}
