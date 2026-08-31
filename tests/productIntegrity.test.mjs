import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('frontend does not ship Gemini SDK directly', async () => {
  const pkg = JSON.parse(await read('package.json'));
  assert.equal(pkg.dependencies?.['@google/genai'], undefined);
});

test('home is rendered intentionally instead of hidden by CSS sibling hacks', async () => {
  const main = await read('src/main.jsx');
  const app = await read('src/App.jsx');
  assert.doesNotMatch(main, /home-simplify\.css/);
  assert.doesNotMatch(app, /function HomeView[\s\S]*hero-panel[\s\S]*function AddView/);
});

test('there is only one Guardinho launcher implementation', async () => {
  const app = await read('src/App.jsx');
  const shell = await read('src/ProductShell.jsx');
  assert.doesNotMatch(app, /FloatingMascot|mascot-launcher|mascot-popup/);
  assert.match(shell, /smart-guardinho-trigger/);
  assert.match(shell, /guardei:open-guardinho/);
});

test('Guardinho nudge consumption never marks content as applied', async () => {
  const shell = await read('src/ProductShell.jsx');
  const start = shell.indexOf('async function markNudgeWatched');
  const end = shell.indexOf('\n  function snoozeNudge', start);
  assert.ok(start >= 0 && end > start, 'markNudgeWatched must exist');
  const block = shell.slice(start, end);
  assert.doesNotMatch(block, /status:\s*['"]aplicado['"]/);
  assert.match(block, /consumedAt:\s*now/);
});

test('achievement tones use known token names', async () => {
  const app = await read('src/App.jsx');
  assert.doesNotMatch(app, /greeFn/);
});

test('Guardinho command consumption never becomes application', async () => {
  const agent = await read('src/lib/guardinhoAgent.js');
  const start = agent.indexOf("if (hasAny(normalized, ['visto'");
  const end = agent.indexOf("if (hasAny(normalized, ['arquiva'", start);
  assert.ok(start >= 0 && end > start);
  const block = agent.slice(start, end);
  assert.match(block, /consumedAt:\s*now/);
  assert.doesNotMatch(block, /status:\s*['"]aplicado['"]/);
  assert.doesNotMatch(block, /applicationStatus/);
});

test('service worker never persists authenticated API GET responses', async () => {
  const sw = await read('public/sw.js');
  const apiGuard = sw.indexOf("requestUrl.pathname.startsWith('/api/')");
  const cacheResponse = sw.indexOf('event.respondWith(', apiGuard);
  assert.ok(apiGuard >= 0, 'service worker must explicitly bypass /api/');
  assert.ok(cacheResponse > apiGuard, 'API bypass must run before cache respondWith');
});

test('service worker notification seen action records consumption, not application', async () => {
  const sw = await read('public/sw.js');
  const start = sw.indexOf('async function markVideoConsumedAndOpen');
  const end = sw.indexOf('\nasync function focusOrOpenApp', start);
  assert.ok(start >= 0 && end > start, 'markVideoConsumedAndOpen must exist');
  const block = sw.slice(start, end);
  assert.match(block, /consumedAt:\s*now/);
  assert.match(block, /watchedAt:\s*now/);
  assert.doesNotMatch(block, /status:\s*['"]aplicado['"]/);
  assert.doesNotMatch(block, /applicationStatus/);
});

test('PWA install and extension security controls stay reachable', async () => {
  const app = await read('src/App.jsx');
  const everywhere = await read('src/features/everywhere/EverywhereLayer.jsx');
  assert.match(app, /Instalar Guardei/);
  assert.match(everywhere, /revokeCaptureToken/);
  assert.match(everywhere, /removeCollection/);
  assert.match(everywhere, /extensionCaptureEnabled/);
});
