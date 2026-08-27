import { CATEGORIES } from './categories.js';
import { buildAutoVideo, createLocalEnrichment } from './aiClassifier.js';
import { extractSupportedVideoUrl } from './tiktok.js';
import { getDisplayTitle, pickSmartRecommendation } from './recommendationEngine.js';

const COMMAND_STOPWORDS = new Set([
  'guardinho', 'marca', 'marcar', 'como', 'visto', 'vista', 'assistido', 'assistida', 'arquiva', 'arquivar',
  'coloca', 'colocar', 'deixa', 'deixar', 'importante', 'favorito', 'favorita', 'rever', 'salva', 'salvar',
  'adiciona', 'adicionar', 'organiza', 'organizar', 'categoriza', 'categorizar', 'categoria', 'recomenda',
  'recomendar', 'indica', 'indicar', 'algo', 'isso', 'esse', 'essa', 'este', 'esta', 'link', 'video', 'vídeo',
  'pra', 'para', 'por', 'favor', 'meu', 'minha', 'nos', 'nas', 'dos', 'das', 'uma', 'um', 'que', 'eu', 'ja', 'já'
]);

export async function executeGuardinhoCommand({ message, videos = [], repository }) {
  const rawMessage = String(message || '').trim();
  const normalized = normalize(rawMessage);
  if (!rawMessage) return response('Me fala o que você quer fazer. Eu consigo salvar, organizar, marcar como visto, arquivar, destacar e recomendar.');

  const url = extractSupportedVideoUrl(rawMessage);
  if (url && hasAny(normalized, ['salva', 'salvar', 'adiciona', 'adicionar', 'guarda', 'guardar', 'link', 'http'])) {
    const existing = videos.find(video => video.url === url || video.canonicalUrl === url);
    if (existing) {
      return response(`👀 Esse já mora aqui: “${getDisplayTitle(existing)}”. Não vou criar duplicata.`, { video: existing });
    }

    const video = await buildAutoVideo({ url, text: rawMessage, origin: 'guardinho-agent' });
    const result = await repository.addVideo(video);
    const saved = result?.video || video;
    return response(`📥 Guardei “${getDisplayTitle(saved)}” e já deixei a organização encaminhada. Menos um link perdido no limbo.`, {
      action: 'save',
      mutated: !result?.duplicated,
      video: saved
    });
  }

  if (hasAny(normalized, ['recomenda', 'recomendar', 'indica', 'indicar', 'escolhe', 'escolher', 'o que vejo', 'o que ver'])) {
    const recommendation = pickSmartRecommendation(videos);
    if (!recommendation) return response('Seu acervo está limpinho demais para eu bancar o cupido de links. Salva alguma coisa primeiro 😅');
    const reason = recommendation.reasons?.[0] ? ` porque ${recommendation.reasons[0]}` : '';
    return response(`🎯 Eu iria de “${getDisplayTitle(recommendation.video)}”${reason}. Se você abrir agora eu prometo não sugerir 47 outras coisas.`, {
      action: 'recommend',
      recommendation,
      video: recommendation.video
    });
  }

  if (hasAny(normalized, ['organiza inbox', 'organizar inbox', 'organiza tudo', 'organizar tudo', 'categoriza inbox', 'arruma inbox'])) {
    const candidates = videos.filter(video => video.status === 'inbox' || !video.category || video.category === 'misc').slice(0, 25);
    if (!candidates.length) return response('🧹 Fui procurar bagunça no Inbox e não achei nada urgente. Estranhamente satisfatório.');

    let changed = 0;
    for (const video of candidates) {
      const enrichment = createLocalEnrichment({
        url: video.url,
        title: video.titleOriginal || video.titleAi || video.titleCustom || '',
        text: [video.sourceText, video.note, video.summary, ...(video.tags || [])].filter(Boolean).join(' ')
      });
      const patch = {
        category: enrichment.category,
        reason: enrichment.reason,
        tags: enrichment.tags,
        priority: enrichment.priority,
        summary: video.summary || enrichment.summary,
        mood: enrichment.mood,
        effort: enrichment.effort,
        durationBucket: enrichment.durationBucket,
        bestFor: enrichment.bestFor,
        watchWhen: enrichment.watchWhen,
        status: enrichment.category === 'misc' ? 'inbox' : 'novo'
      };
      await repository.updateVideo(video.id, patch);
      changed += 1;
    }

    return response(`🧹 Dei uma geral em ${changed} ${changed === 1 ? 'item' : 'itens'} do Inbox. O Guardinho agora exige uma pequena salva de palmas.`, {
      action: 'organize-inbox',
      mutated: changed > 0,
      count: changed
    });
  }

  const category = findRequestedCategory(normalized);
  if (category && hasAny(normalized, ['categoria', 'categoriza', 'categorizar', 'coloca', 'colocar', 'move', 'mover', 'joga'])) {
    const target = findVideoTarget(rawMessage, videos, category.label);
    if (!target) return response(`Eu entendi a categoria ${category.label}, mas não consegui descobrir qual item você quer mover. Fala um pedaço do título.`);
    await repository.updateVideo(target.id, { category: category.id, status: target.status === 'inbox' ? 'novo' : target.status });
    return response(`🏷️ Pronto. “${getDisplayTitle(target)}” agora está em ${category.label}.`, {
      action: 'categorize',
      mutated: true,
      video: { ...target, category: category.id }
    });
  }

  if (hasAny(normalized, ['visto', 'vista', 'assistido', 'assistida', 'ja vi', 'já vi', 'terminei', 'conclui'])) {
    const target = findVideoTarget(rawMessage, videos);
    if (!target) return response('Qual deles você já viu? Me dá um pedaço do título que eu resolvo.');
    const now = new Date().toISOString();
    await repository.updateVideo(target.id, {
      status: 'aplicado',
      watchedAt: now,
      reviewedAt: now,
      watchCount: Number(target.watchCount || 0) + 1,
      watchedSeconds: Number(target.watchedSeconds || 0) || 300
    });
    return response(`✅ “${getDisplayTitle(target)}” saiu oficialmente do purgatório do “depois eu vejo”.`, {
      action: 'mark-watched',
      mutated: true,
      video: { ...target, status: 'aplicado', watchedAt: now }
    });
  }

  if (hasAny(normalized, ['arquiva', 'arquivar', 'arquivado', 'tira da fila', 'some com'])) {
    const target = findVideoTarget(rawMessage, videos);
    if (!target) return response('Qual item eu arquivo? Me fala parte do título. Não vou arquivar no chute.');
    await repository.updateVideo(target.id, { status: 'arquivado', reviewedAt: new Date().toISOString() });
    return response(`📦 Arquivei “${getDisplayTitle(target)}”. Sem drama, ele continua no acervo se você mudar de ideia.`, {
      action: 'archive',
      mutated: true,
      video: { ...target, status: 'arquivado' }
    });
  }

  if (hasAny(normalized, ['importante', 'favorito', 'favorita', 'estrela', 'prioridade alta'])) {
    const target = findVideoTarget(rawMessage, videos);
    if (!target) return response('Qual item merece tratamento VIP? Me dá um pedaço do título.');
    await repository.updateVideo(target.id, { status: 'importante', priority: 'alta' });
    return response(`⭐ “${getDisplayTitle(target)}” virou importante. Agora eu tenho autorização moral para te cobrar depois.`, {
      action: 'important',
      mutated: true,
      video: { ...target, status: 'importante', priority: 'alta' }
    });
  }

  if (hasAny(normalized, ['rever', 'revisar', 'ver depois de novo'])) {
    const target = findVideoTarget(rawMessage, videos);
    if (!target) return response('Qual item você quer deixar marcado para rever? Me fala parte do título.');
    await repository.updateVideo(target.id, { status: 'rever', reviewedAt: new Date().toISOString() });
    return response(`🔁 “${getDisplayTitle(target)}” entrou na fila de revisão. Eu guardo a cobrança para a hora certa.`, {
      action: 'review-later',
      mutated: true,
      video: { ...target, status: 'rever' }
    });
  }

  return response('Eu já consigo agir no seu acervo, não só conversar. Tenta “me recomenda algo”, “marca [título] como visto”, “arquiva [título]”, “coloca [título] em Design”, “organiza o inbox” ou cola um link para eu salvar. ✨');
}

function findRequestedCategory(normalizedMessage) {
  return CATEGORIES.find(category => {
    const candidates = [category.id, category.label, ...(category.keywords || []).slice(0, 3)].map(normalize);
    return candidates.some(candidate => candidate && includesWord(normalizedMessage, candidate));
  }) || null;
}

function findVideoTarget(message, videos = [], categoryLabelToIgnore = '') {
  const active = videos.filter(video => video.status !== 'arquivado');
  if (!active.length) return null;

  const quoted = String(message).match(/[“"']([^”"']{3,})[”"']/)?.[1];
  if (quoted) {
    const normalizedQuoted = normalize(quoted);
    const direct = active.find(video => normalize(searchableVideoText(video)).includes(normalizedQuoted));
    if (direct) return direct;
  }

  const ignoredCategory = normalize(categoryLabelToIgnore);
  const tokens = normalize(message)
    .split(/[^a-z0-9]+/)
    .filter(token => token.length >= 3 && !COMMAND_STOPWORDS.has(token) && token !== ignoredCategory);

  if (!tokens.length) return active.length === 1 ? active[0] : null;

  const ranked = active
    .map(video => {
      const haystack = normalize(searchableVideoText(video));
      let score = 0;
      for (const token of tokens) {
        if (haystack.includes(token)) score += token.length >= 6 ? 3 : 1.5;
      }
      const title = normalize(getDisplayTitle(video));
      if (tokens.some(token => title.includes(token))) score += 2;
      return { video, score };
    })
    .sort((a, b) => b.score - a.score);

  if (!ranked[0] || ranked[0].score <= 0) return null;
  if (ranked[1] && ranked[0].score === ranked[1].score && ranked[0].score < 4) return null;
  return ranked[0].video;
}

function searchableVideoText(video) {
  return [
    getDisplayTitle(video), video.titleOriginal, video.authorName, video.category, video.note, video.summary,
    video.sourceText, ...(video.tags || [])
  ].filter(Boolean).join(' ');
}

function hasAny(normalizedMessage, terms) {
  return terms.some(term => normalizedMessage.includes(normalize(term)));
}

function includesWord(haystack, needle) {
  if (!needle) return false;
  return ` ${haystack} `.includes(` ${needle} `) || haystack.includes(needle);
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function response(answer, extra = {}) {
  return { answer, mutated: false, ...extra };
}
