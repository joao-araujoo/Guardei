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
