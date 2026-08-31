const defaults = { apiBase: 'http://localhost:3333', captureToken: '', contextAssist: false };
const apiBaseInput = document.getElementById('apiBase');
const captureTokenInput = document.getElementById('captureToken');
const contextAssistInput = document.getElementById('contextAssist');
const statusNode = document.getElementById('status');

(async () => {
  const data = { ...defaults, ...await chrome.storage.sync.get(defaults) };
  apiBaseInput.value = data.apiBase;
  captureTokenInput.value = data.captureToken;
  contextAssistInput.checked = Boolean(data.contextAssist);
})();

document.getElementById('save').addEventListener('click', async () => {
  const apiBase = apiBaseInput.value.trim().replace(/\/$/, '');
  if (apiBase && !/^https?:\/\//i.test(apiBase)) {
    statusNode.textContent = 'Use uma URL http:// ou https:// válida.';
    return;
  }
  await chrome.storage.sync.set({
    apiBase,
    captureToken: captureTokenInput.value.trim(),
    contextAssist: contextAssistInput.checked,
  });
  statusNode.textContent = 'Configuração salva ✓';
  setTimeout(() => { statusNode.textContent = ''; }, 2200);
});
