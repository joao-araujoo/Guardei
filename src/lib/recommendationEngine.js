const DAY_MS = 24 * 60 * 60 * 1000;
const EXCLUDED_STATUSES = new Set(['arquivado', 'aplicado']);

export function rankSmartRecommendations(videos = [], options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const active = videos.filter(video => video?.url && !EXCLUDED_STATUSES.has(video.status));
  const watchedCategories = new Set(
    videos
      .filter(video => video.status === 'aplicado' || video.watchedAt)
      .map(video => video.category)
      .filter(Boolean)
  );

  return active
    .map(video => {
      const score = scoreVideo(video, { now, watchedCategories, options });
      return {
        video,
        score: score.total,
        reasons: score.reasons,
        context: score.context
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function pickSmartRecommendation(videos = [], options = {}) {
  const ranked = rankSmartRecommendations(videos, options);
  if (!ranked.length) return null;

  const topScore = ranked[0].score;
  const candidates = ranked.filter(item => item.score >= topScore - 1.75).slice(0, 4);
  const daySeed = dayOfYear(options.now ? new Date(options.now) : new Date());
  const index = Math.abs(hashString(`${candidates.map(item => item.video.id).join(':')}:${daySeed}`)) % candidates.length;
  return candidates[index] || ranked[0];
}

export function pickStaleNudge(videos = [], options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const minAgeDays = Number.isFinite(options.minAgeDays) ? options.minAgeDays : 7;
  const ranked = rankSmartRecommendations(videos, { ...options, now });

  return ranked.find(item => {
    const ageDays = daysSince(item.video.reviewedAt || item.video.createdAt, now);
    return ageDays >= minAgeDays;
  }) || null;
}

export function buildSmartNudgeCopy(video, options = {}) {
  if (!video) return null;
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const referenceDate = video.reviewedAt || video.createdAt;
  const ageDays = Math.max(0, Math.floor(daysSince(referenceDate, now)));
  const title = getDisplayTitle(video);
  const shortTitle = truncate(title, 62);
  const important = video.status === 'importante' || video.priority === 'alta';

  let variants;
  if (important && ageDays >= 7) {
    variants = [
      { title: '🚨 O Guardinho abriu o cofre', body: `Você marcou “${shortTitle}” como importante e depois evaporou. Bora resolver isso?` },
      { title: '⭐ Importante, lembra?', body: `“${shortTitle}” está há ${ageDays} dias esperando o tratamento VIP que você prometeu.` },
      { title: '👀 Eu vi essa estrelinha aí', body: `Você disse que “${shortTitle}” era importante. Eu trouxe a prova. Abre agora?` }
    ];
  } else if (ageDays >= 45) {
    variants = [
      { title: '🗿 Achado arqueológico', body: `“${shortTitle}” está guardado há ${ageDays} dias. Isso é acervo ou sítio histórico?` },
      { title: '📦 Já pode cobrar aluguel', body: `“${shortTitle}” mora no seu Guardei há ${ageDays} dias. Hoje ele sai do quarto?` },
      { title: '🕸️ O Guardinho trouxe um espanador', body: `Encontrei “${shortTitle}” debaixo de ${ageDays} dias de poeira digital.` }
    ];
  } else if (ageDays >= 21) {
    variants = [
      { title: '🫣 A gente precisa falar sobre isso', body: `Faz ${ageDays} dias que você salvou “${shortTitle}”. Eu finjo que não vi ou você abre?` },
      { title: '🐢 Sem pressa… talvez com um pouco', body: `“${shortTitle}” entrou no Guardei há ${ageDays} dias e segue firme no modo “depois eu vejo”.` },
      { title: '🧹 Faxina de 5 min?', body: `Vamos tirar “${shortTitle}” da pilha antes que ele vire patrimônio histórico?` }
    ];
  } else if (ageDays >= 7) {
    variants = [
      { title: '👀 Uma semana depois…', body: `Você salvou “${shortTitle}” e nunca mais voltou. Coincidência? O Guardinho acha que não.` },
      { title: '🧠 Seu eu do passado deixou um recado', body: `Há ${ageDays} dias ele achou “${shortTitle}” importante o bastante para salvar. Quer descobrir por quê?` },
      { title: '🤏 É só um linkzinho', body: `“${shortTitle}” está esperando há ${ageDays} dias. Prometo parar de encarar se você abrir.` }
    ];
  } else {
    variants = [
      { title: '✨ O Guardinho escolheu por você', body: `Se você tem alguns minutos agora, “${shortTitle}” é uma boa próxima escolha.` },
      { title: '🎯 Sem rolar feed infinito', body: `Eu escolheria “${shortTitle}” agora. Um conteúdo do seu acervo vale mais que 30 aleatórios.` },
      { title: '🧠 Modo piloto automático do bem', body: `Não decide nada: só abre “${shortTitle}”. Eu já fiz a parte chata por você.` }
    ];
  }

  const variantIndex = Math.abs(hashString(`${video.id}:${ageDays}:${dayOfYear(now)}`)) % variants.length;
  return {
    ...variants[variantIndex],
    ageDays,
    videoId: video.id,
    url: video.url,
    displayTitle: title
  };
}

export function getDisplayTitle(video) {
  return String(video?.titleCustom || video?.titleAi || video?.titleOriginal || 'Link salvo').trim();
}

export function daysSince(value, now = new Date()) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, (now.getTime() - timestamp) / DAY_MS);
}

function scoreVideo(video, { now, watchedCategories, options }) {
  const reasons = [];
  let total = 0;
  const ageDays = daysSince(video.reviewedAt || video.createdAt, now);
  const context = buildContext(now, options);

  const priorityScore = { alta: 11, media: 6, baixa: 2 }[video.priority] ?? 2;
  total += priorityScore;
  if (video.priority === 'alta') reasons.push('você marcou como prioridade alta');

  const statusScore = { importante: 12, rever: 8, inbox: 3, novo: 5 }[video.status] ?? 2;
  total += statusScore;
  if (video.status === 'importante') reasons.push('está nos seus importantes');
  if (video.status === 'rever') reasons.push('você já pediu para rever');

  const staleScore = Math.min(16, ageDays * 0.45);
  total += staleScore;
  if (ageDays >= 7) reasons.push(`está parado há ${Math.floor(ageDays)} dias`);

  const reviewCount = Number(video.reviewCount || 0);
  total -= Math.min(6, reviewCount * 1.25);

  const durationFit = scoreDuration(video.durationBucket, context.availableMinutes);
  total += durationFit;
  if (durationFit >= 5) reasons.push(`combina com uma janela de ~${context.availableMinutes} min`);

  const effortFit = scoreEffort(video.effort, context.dayPart);
  total += effortFit;
  if (effortFit >= 3) reasons.push(`o esforço combina com este horário`);

  if (video.category && !watchedCategories.has(video.category)) {
    total += 2.5;
    reasons.push('traz variedade para o que você costuma consumir');
  }

  if (video.status === 'inbox') total += Math.min(3, ageDays * 0.15);
  if (video.thumbnailUrl) total += 0.5;
  if (video.summary) total += 0.75;
  if (video.bestFor) total += 0.5;

  return { total, reasons: reasons.slice(0, 3), context };
}

function buildContext(now, options = {}) {
  const hour = now.getHours();
  let dayPart = 'day';
  let availableMinutes = 12;

  if (hour < 7) {
    dayPart = 'late';
    availableMinutes = 5;
  } else if (hour < 12) {
    dayPart = 'morning';
    availableMinutes = 12;
  } else if (hour < 14) {
    dayPart = 'lunch';
    availableMinutes = 8;
  } else if (hour < 18) {
    dayPart = 'afternoon';
    availableMinutes = 12;
  } else if (hour < 22) {
    dayPart = 'evening';
    availableMinutes = 25;
  } else {
    dayPart = 'late';
    availableMinutes = 7;
  }

  if (Number.isFinite(options.availableMinutes)) {
    availableMinutes = Math.max(2, Math.min(180, Number(options.availableMinutes)));
  }

  return { hour, dayPart, availableMinutes };
}

function scoreDuration(bucket, availableMinutes) {
  if (!bucket || bucket === 'unknown') return 1;
  if (bucket === 'short') return availableMinutes <= 12 ? 6 : 4;
  if (bucket === 'medium') return availableMinutes >= 10 ? 6 : 1;
  if (bucket === 'long') return availableMinutes >= 25 ? 7 : -5;
  return 0;
}

function scoreEffort(effort, dayPart) {
  if (dayPart === 'late') return effort === 'baixo' ? 5 : effort === 'alto' ? -4 : 1;
  if (dayPart === 'morning') return effort === 'alto' ? 4 : 2;
  if (dayPart === 'evening') return effort === 'alto' ? 4 : 3;
  return effort === 'medio' ? 3 : 2;
}

function truncate(value, maxLength) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(1, maxLength - 1)).trim()}…`;
}

function hashString(value) {
  let hash = 0;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start + ((start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000);
  return Math.floor(diff / DAY_MS);
}
