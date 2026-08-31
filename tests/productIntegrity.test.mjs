import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('frontend does not ship Gemini SDK directly', async () => {
  const pkg = JSON.parse(await read('package.json'));
  assert.equal(pkg.dependencies?.['@google/genai'], undefined);
});

test('production manifests are pinned and deploy through safe migrations', async () => {
  const frontend = JSON.parse(await read('package.json'));
  const backend = JSON.parse(await read('server/package.json'));
  const allSpecs = [
    ...Object.values(frontend.dependencies || {}),
    ...Object.values(frontend.devDependencies || {}),
    ...Object.values(backend.dependencies || {})
  ];
  assert.equal(frontend.name, 'guardei');
  assert.equal(backend.name, 'guardei-server');
  assert.ok(allSpecs.every(spec => spec !== 'latest'), 'direct dependencies must not float on latest');
  assert.equal(frontend.dependencies?.['@vitejs/plugin-react'], undefined);
  assert.equal(frontend.devDependencies?.['@vitejs/plugin-react'], undefined);
  assert.match(frontend.scripts?.['render:build'] || '', /npm ci --prefix server/);
  assert.match(frontend.scripts?.['render:build'] || '', /db:migrate:production/);
  assert.doesNotMatch(frontend.scripts?.['render:build'] || '', /db:push/);
  assert.equal(backend.scripts?.['db:migrate:deploy'], 'prisma migrate deploy');
  assert.equal(backend.scripts?.['db:migrate:production'], 'node scripts/migrate-production.js');
});

test('production migration adoption refuses unverified legacy drift', async () => {
  const script = await read('server/scripts/migrate-production.js');
  assert.match(script, /migrate["']?,\s*["']diff/);
  assert.match(script, /allowDiffExit:\s*true/);
  assert.match(script, /if \(diff\.status === 2\)/);
  assert.match(script, /adocao automatica foi interrompida/);
  assert.match(script, /migrate["']?,\s*["']resolve/);
  assert.match(script, /migrate["']?,\s*["']deploy/);
});

test('authentication routes rate-limit attempts and bound expensive password input', async () => {
  const auth = await read('server/src/routes/authRoutes.js');
  assert.match(auth, /createRateLimiter/);
  assert.match(auth, /limit:\s*20/);
  assert.match(auth, /router\.post\("\/login",\s*authRateLimit/);
  assert.match(auth, /router\.post\("\/register",\s*authRateLimit/);
  assert.match(auth, /password\.length > 256/);
  assert.match(auth, /email\.length > 320/);
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

test('extension contextual browsing is opt-in and avoids redundant tabs permission', async () => {
  const manifest = JSON.parse(await read('extension/manifest.json'));
  const background = await read('extension/background.js');
  const content = await read('extension/content.js');
  const options = await read('extension/options.js');
  assert.ok(!manifest.permissions.includes('tabs'));
  assert.match(background, /contextAssist:false/);
  assert.match(options, /contextAssist:\s*false/);
  assert.match(content, /chrome\.storage\.sync\.get\(\{contextAssist:false\}\)/);
  const privacyGuard = content.indexOf('if(!settings.contextAssist)return');
  const pageTextRead = content.indexOf("document.body?.innerText");
  assert.ok(privacyGuard >= 0 && pageTextRead > privacyGuard, 'page text must only be read after opt-in');
});

test('PWA install and extension security controls stay reachable', async () => {
  const app = await read('src/App.jsx');
  const everywhere = await read('src/features/everywhere/EverywhereLayer.jsx');
  assert.match(app, /Instalar Guardei/);
  assert.match(everywhere, /revokeCaptureToken/);
  assert.match(everywhere, /removeCollection/);
  assert.match(everywhere, /extensionCaptureEnabled/);
});
