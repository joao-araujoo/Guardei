import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const srcRoot = path.join(root, 'src');

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectSourceFiles(fullPath));
    else if (/\.(?:js|jsx|mjs|html)$/i.test(entry.name) && entry.name !== 'localIconify.js') files.push(fullPath);
  }
  return files;
}

async function collectUsedNames() {
  const names = new Set();
  const matcher = /lucide:([a-z0-9-]+)/g;
  for (const file of await collectSourceFiles(srcRoot)) {
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(matcher)) names.add(match[1]);
  }
  return [...names].sort();
}

test('frontend does not execute Iconify from a remote CDN', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /code\.iconify\.design|iconify-icon\.min\.js/i);
  assert.match(html, /src="\/src\/main\.jsx"/);
});

test('local Lucide runtime covers every icon referenced by the frontend', async () => {
  const runtime = await readFile(path.join(srcRoot, 'lib', 'localIconify.js'), 'utf8');
  const match = runtime.match(/export const LOCAL_LUCIDE_ICON_NAMES = Object\.freeze\((\[[\s\S]*?\])\);/);
  assert.ok(match, 'generated runtime must expose LOCAL_LUCIDE_ICON_NAMES');
  const catalogNames = JSON.parse(match[1]);
  const usedNames = await collectUsedNames();
  assert.deepEqual(catalogNames, usedNames);
  assert.match(runtime, /customElements\.define\('iconify-icon'/);
  assert.doesNotMatch(runtime, /https?:\/\//i, 'runtime must not fetch icons at runtime');
});

test('main entry registers the local icon runtime before rendering', async () => {
  const main = await readFile(path.join(srcRoot, 'main.jsx'), 'utf8');
  assert.match(main, /import ['"]\.\/lib\/localIconify\.js['"];?/);
});
