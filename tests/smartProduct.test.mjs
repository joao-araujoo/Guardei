import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSmartNudgeCopy, pickSmartRecommendation, rankSmartRecommendations } from '../src/lib/recommendationEngine.js';
import { executeGuardinhoCommand } from '../src/lib/guardinhoAgent.js';

const NOW = new Date('2026-08-27T15:00:00-03:00');

function video(overrides = {}) {
  return {
    id: overrides.id || crypto.randomUUID(),
    url: 'https://example.com/item',
    titleAi: 'Conteúdo de teste',
    titleCustom: '',
    titleOriginal: '',
    category: 'tech',
    priority: 'media',
    status: 'novo',
    durationBucket: 'medium',
    effort: 'medio',
    reviewCount: 0,
    watchCount: 0,
    watchedSeconds: 0,
    createdAt: '2026-08-10T12:00:00Z',
    reviewedAt: null,
    watchedAt: null,
    tags: [],
    ...overrides
  };
}

test('prioriza item antigo e importante sobre item recente de baixa prioridade', () => {
  const important = video({
    id: 'important',
    titleAi: 'Guia importante',
    status: 'importante',
    priority: 'alta',
    createdAt: '2026-07-01T12:00:00Z'
  });
  const recent = video({
    id: 'recent',
    titleAi: 'Coisa recente',
    priority: 'baixa',
    createdAt: '2026-08-27T12:00:00Z'
  });

  const ranked = rankSmartRecommendations([recent, important], { now: NOW });
  assert.equal(ranked[0].video.id, 'important');
  assert.ok(ranked[0].score > ranked[1].score);
});

test('não recomenda itens aplicados ou arquivados', () => {
  const active = video({ id: 'active' });
  const applied = video({ id: 'applied', status: 'aplicado', priority: 'alta' });
  const archived = video({ id: 'archived', status: 'arquivado', priority: 'alta' });

  const recommendation = pickSmartRecommendation([applied, archived, active], { now: NOW });
  assert.equal(recommendation.video.id, 'active');
});

test('gera lembrete bem-humorado para conteúdo esquecido', () => {
  const stale = video({
    id: 'stale',
    titleAi: 'Tutorial que eu jurei que veria',
    createdAt: '2026-07-01T12:00:00Z'
  });

  const copy = buildSmartNudgeCopy(stale, { now: NOW });
  assert.ok(copy.ageDays >= 45);
  assert.match(copy.body, /Tutorial|tutorial|dias/);
  assert.ok(copy.title.length > 0);
});

test('Guardinho marca item como visto sem apagar nada', async () => {
  const target = video({ id: 'react', titleAi: 'Tutorial de React para forms' });
  const calls = [];
  const repository = {
    async updateVideo(id, patch) {
      calls.push({ type: 'update', id, patch });
      return { ...target, ...patch };
    },
    async addVideo() {
      throw new Error('não deveria adicionar');
    },
    async deleteVideo() {
      calls.push({ type: 'delete' });
    }
  };

  const result = await executeGuardinhoCommand({
    message: 'marca o tutorial de React como visto',
    videos: [target],
    repository
  });

  assert.equal(result.mutated, true);
  assert.equal(result.action, 'mark-watched');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, 'update');
  assert.equal(calls[0].patch.status, 'aplicado');
});

test('Guardinho não executa exclusão por comando', async () => {
  const target = video({ id: 'safe', titleAi: 'Item que deve continuar existindo' });
  let deleted = false;
  const repository = {
    async updateVideo() {},
    async addVideo() {},
    async deleteVideo() { deleted = true; }
  };

  const result = await executeGuardinhoCommand({
    message: 'apaga definitivamente o item que deve continuar existindo',
    videos: [target],
    repository
  });

  assert.equal(result.mutated, false);
  assert.equal(deleted, false);
});
