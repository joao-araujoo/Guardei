const configuredBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_VAULT_API_URL || window.VAULT_API_URL || '';
const API_BASE = configuredBase.replace(/\/$/, '');

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.message || 'Não foi possível concluir a solicitação.');
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export const everywhereService = {
  settings: () => request('/api/settings'),
  updateSettings: patch => request('/api/settings', { method: 'PATCH', body: patch }),
  videos: () => request('/api/videos'),
  updateVideo: (id, patch) => request(`/api/videos/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }),
  captureUrl: payload => request('/api/capture/url', { method: 'POST', body: payload }),
  captureScreenshot: payload => request('/api/capture/screenshot', { method: 'POST', body: payload }),
  captureThought: payload => request('/api/capture/thought', { method: 'POST', body: payload }),
  context: params => request(`/api/capture/context?${new URLSearchParams(params).toString()}`),
  digest: () => request('/api/digests/weekly'),
  refreshDigest: () => request('/api/digests/weekly', { method: 'POST', body: {} }),
  spaces: () => request('/api/spaces'),
  synthesize: q => request(`/api/synthesis?q=${encodeURIComponent(q)}`),
  importBookmarks: payload => request('/api/import/bookmarks', { method: 'POST', body: payload }),
  collections: () => request('/api/collections'),
  createCollection: payload => request('/api/collections', { method: 'POST', body: payload }),
  importCollection: slug => request(`/api/collections/public/${encodeURIComponent(slug)}/import`, { method: 'POST', body: {} }),
  addCollectionItems: (id, videoIds) => request(`/api/collections/${encodeURIComponent(id)}/items`, { method: 'POST', body: { videoIds } }),
  removeCollection: id => request(`/api/collections/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  captureTokens: () => request('/api/capture-tokens'),
  createCaptureToken: name => request('/api/capture-tokens', { method: 'POST', body: { name } }),
  revokeCaptureToken: id => request(`/api/capture-tokens/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  integrations: () => request('/api/integrations'),
  whatsappCode: () => request('/api/integrations/whatsapp/connect-code', { method: 'POST', body: {} }),
  removeIntegration: id => request(`/api/integrations/${encodeURIComponent(id)}`, { method: 'DELETE' })
};

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Não foi possível ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}
