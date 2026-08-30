import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { mapIntentToReason, normalizeSavedFor } from '../server/src/everywhere/captureService.js';
import { weekKeyFor } from '../server/src/everywhere/digestService.js';
import { buildAutomaticSpaces } from '../server/src/everywhere/spaceService.js';
import { analyzeScreenshot } from '../server/src/everywhere/visionService.js';
import { isExtensionOrigin } from '../server/src/middleware/security.js';

test('save intent accepts only the small product vocabulary', () => {
  assert.equal(normalizeSavedFor('aprender'), 'aprender');
  assert.equal(normalizeSavedFor('ver-depois'), 'ver-depois');
  assert.equal(normalizeSavedFor('qualquer-coisa'), '');
  assert.equal(mapIntentToReason('ver-depois'), 'guardar');
  assert.equal(mapIntentToReason('aplicar'), 'aplicar');
});

test('week keys are stable around ISO week boundaries', () => {
  assert.equal(weekKeyFor(new Date('2026-08-29T12:00:00Z')), '2026-W35');
  assert.equal(weekKeyFor(new Date('2026-01-01T12:00:00Z')), '2026-W01');
});

test('automatic spaces require recurring evidence instead of creating empty folders', async () => {
  const prisma = {
    video: {
      findMany: async () => [
        { id: 'a', category: 'dev', tags: ['react', 'frontend'], capsule: { concepts: ['React', 'Hooks'] } },
        { id: 'b', category: 'dev', tags: ['react', 'typescript'], capsule: { concepts: ['React', 'Types'] } },
        { id: 'c', category: 'design', tags: ['ui'], capsule: { concepts: ['Design system'] } },
      ],
    },
  };
  const spaces = await buildAutomaticSpaces(prisma, 'user-1');
  assert.ok(spaces.some(space => space.name === 'Dev' && space.count === 2));
  assert.ok(spaces.some(space => space.name === 'React' && space.count === 2));
  assert.ok(!spaces.some(space => space.name === 'Design'));
});

test('screenshot parser works without sending an image to AI when OCR is disabled', async () => {
  const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZB3sAAAAASUVORK5CYII=';
  const result = await analyzeScreenshot(tinyPng, { enableAi: false });
  assert.equal(result.image.mimeType, 'image/png');
  assert.equal(result.title, 'Screenshot salvo');
  assert.equal(result.text, '');
});

test('extension origin allowlist is protocol-specific', () => {
  assert.equal(isExtensionOrigin('chrome-extension://abcdefghijklmnop'), true);
  assert.equal(isExtensionOrigin('moz-extension://abc-123'), true);
  assert.equal(isExtensionOrigin('https://evil.example'), false);
  assert.equal(isExtensionOrigin('chrome-extension://bad/path'), false);
});

test('Manifest V3 extension exposes one-click, context and screenshot capabilities', async () => {
  const manifest = JSON.parse(await fs.readFile(new URL('../extension/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.ok(manifest.permissions.includes('contextMenus'));
  assert.ok(manifest.permissions.includes('activeTab'));
  assert.equal(manifest.background.type, 'module');
  assert.equal(manifest.action.default_popup, 'popup.html');
  assert.ok(manifest.content_scripts?.some(entry => entry.js?.includes('content.js')));
});
