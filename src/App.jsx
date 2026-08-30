import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, CATEGORY_BY_ID, REASONS, STATUS } from './lib/categories.js';
import { buildAutoVideo } from './lib/aiClassifier.js';
import { PLATFORM_OPTIONS, getPlatformMeta } from './lib/platforms.js';
import { createRepository, exportVault, importVaultPayload } from './lib/storage.js';
import { extractSupportedVideoUrl, getSharePayloadFromUrl } from './lib/tiktok.js';
import CapsulePanel from './features/capsules/CapsulePanel.jsx';
import SmartSearch from './features/search/SmartSearch.jsx';
import PathsView from './features/paths/PathsView.jsx';
import PathDetails from './features/paths/PathDetails.jsx';
import RelatedItems from './features/connections/RelatedItems.jsx';
import KnowledgeMap from './features/connections/KnowledgeMap.jsx';
import ReflectionForm from './features/reflections/ReflectionForm.jsx';
import KnowledgeCardPanel from './features/cards/KnowledgeCardPanel.jsx';
import CardReviewSession from './features/cards/CardReviewSession.jsx';
import ApplicationList from './features/applications/ApplicationList.jsx';
import TodayHub from './features/today/TodayHub.jsx';
import KnowledgeDashboard from './features/knowledge/KnowledgeDashboard.jsx';
import { searchLibrary } from './services/searchService.js';
import { pathService } from './services/pathService.js';
import { knowledgeService } from './services/knowledgeService.js';
import guardeiLogo from './assets/icons/guardei-logo.png';
import guardeiMascot from './assets/mascot/guardei-mascot.png';

function IconSymbol({ name, size = 'normal' }) {
  const icons = {
    code: 'lucide:code-2',
    settings: 'lucide:settings',
    brain: 'lucide:brain',
    palette: 'lucide:palette',
    wallet: 'lucide:wallet',
    heart: 'lucide:heart',
    zap: 'lucide:zap',
    star: 'lucide:star',
    music: 'lucide:music',
    film: 'lucide:film',
    inbox: 'lucide:inbox',
    archive: 'lucide:archive',
    check: 'lucide:check-circle-2',
    repeat: 'lucide:repeat-2',
    home: 'lucide:home',
    book: 'lucide:library',
    library: 'lucide:library',
    plus: 'lucide:plus',
    menu: 'lucide:menu',
    search: 'lucide:search',
    bookmark: 'lucide:bookmark',
    user: 'lucide:user-round',
    logout: 'lucide:log-out',
    save: 'lucide:save',
    download: 'lucide:download',
    upload: 'lucide:upload',
    link: 'lucide:link',
    bot: 'lucide:bot',
    trophy: 'lucide:trophy',
    chart: 'lucide:bar-chart-3',
    clock: 'lucide:clock-3',
    eye: 'lucide:eye',
    edit: 'lucide:pencil',
    tag: 'lucide:tags',
    flag: 'lucide:flag',
    sparkles: 'lucide:sparkles',
    target: 'lucide:target',
    smile: 'lucide:smile',
    gauge: 'lucide:gauge',
    source: 'lucide:folder-input',
    route: 'lucide:route',
    map: 'lucide:network',
    cards: 'lucide:gallery-vertical-end',
    lightbulb: 'lucide:lightbulb',
    practice: 'lucide:hammer',
    calendar: 'lucide:calendar-days'
  };
  const sizeClass = size === 'large' ? 'icon-large' : size === 'small' ? 'icon-small' : '';
  return <span className={`icon-symbol ${sizeClass}`}><iconify-icon icon={icons[name] || icons.bookmark} /></span>;
}

const repository = createRepository();
const DEFAULT_FILTERS = { query: '', category: 'all', status: 'active', platform: 'all', capsule: 'all' };
const DEFAULT_RECOMMENDATION = { time: 'any', mood: 'any', platform: 'all' };
const ACHIEVEMENTS = [
  { id: 'first-save', icon: 'bookmark', tone: 'green', title: 'Primeiro Cofrinho', text: 'Salvar o primeiro item.', test: s => s.total >= 1 },
  { id: 'save-5', icon: 'archive', tone: 'yellow', title: 'Começou o Acervo', text: 'Salvar 5 itens.', test: s => s.total >= 5 },
  { id: 'save-10', icon: 'book', tone: 'blue', title: 'Prateleira Cheia', text: 'Salvar 10 itens.', test: s => s.total >= 10 },
  { id: 'save-25', icon: 'library', tone: 'pink', title: 'Colecionador', text: 'Salvar 25 itens.', test: s => s.total >= 25 },
  { id: 'save-50', icon: 'sparkles', tone: 'purple', title: 'Arquivo Vivo', text: 'Salvar 50 itens.', test: s => s.total >= 50 },
  { id: 'save-100', icon: 'trophy', tone: 'red', title: 'Guarda Mestre', text: 'Salvar 100 itens.', test: s => s.total >= 100 },
  { id: 'first-watch', icon: 'eye', tone: 'green', title: 'Saiu do Depois', text: 'Marcar o primeiro item como consumido.', test: s => s.watched >= 1 },
  { id: 'watch-3', icon: 'check', tone: 'yellow', title: 'Três Revisões', text: 'Registrar 3 conteúdos consumidos.', test: s => s.watched >= 3 },
  { id: 'watch-5', icon: 'check', tone: 'blue', title: 'Fila Andando', text: 'Registrar 5 conteúdos consumidos.', test: s => s.watched >= 5 },
  { id: 'watch-10', icon: 'target', tone: 'pink', title: 'Ritmo Bom', text: 'Registrar 10 conteúdos consumidos.', test: s => s.watched >= 10 },
  { id: 'watch-15', icon: 'target', tone: 'purple', title: 'Revisor Fiel', text: 'Registrar 15 conteúdos consumidos.', test: s => s.watched >= 15 },
  { id: 'watch-30', icon: 'trophy', tone: 'red', title: 'Acervo Vivo', text: 'Registrar 30 conteúdos consumidos.', test: s => s.watched >= 30 },
  { id: 'watch-60', icon: 'zap', tone: 'greeFn', title: 'Sem Poeira', text: 'Registrar 60 conteúdos consumidos.', test: s => s.watched >= 60 },
  { id: 'hour-1', icon: 'clock', tone: 'yellow', title: 'Uma Hora Investida', text: 'Registrar 60 minutos assistidos.', test: s => s.minutes >= 60 },
  { id: 'hour-3', icon: 'clock', tone: 'blue', title: 'Sessão Tripla', text: 'Registrar 3 horas assistidas.', test: s => s.minutes >= 180 },
  { id: 'hour-5', icon: 'clock', tone: 'pink', title: 'Maratoninha Consciente', text: 'Registrar 5 horas assistidas.', test: s => s.minutes >= 300 },
  { id: 'hour-10', icon: 'gauge', tone: 'purple', title: 'Foco de Dez Horas', text: 'Registrar 10 horas assistidas.', test: s => s.minutes >= 600 },
  { id: 'hour-20', icon: 'zap', tone: 'red', title: 'Consumo com Memória', text: 'Registrar 20 horas assistidas.', test: s => s.minutes >= 1200 },
  { id: 'categories-2', icon: 'palette', tone: 'green', title: 'Dois Mundos', text: 'Consumir conteúdos em 2 categorias.', test: s => s.watchedCategories >= 2 },
  { id: 'categories-3', icon: 'palette', tone: 'yellow', title: 'Explorador', text: 'Consumir conteúdos em 3 categorias.', test: s => s.watchedCategories >= 3 },
  { id: 'categories-5', icon: 'sparkles', tone: 'blue', title: 'Radar Aberto', text: 'Consumir conteúdos em 5 categorias.', test: s => s.watchedCategories >= 5 },
  { id: 'categories-7', icon: 'star', tone: 'pink', title: 'Curadoria Ampla', text: 'Consumir conteúdos em 7 categorias.', test: s => s.watchedCategories >= 7 },
  { id: 'categories-all', icon: 'trophy', tone: 'purple', title: 'Mapa Completo', text: 'Consumir conteúdos em todas as categorias.', test: s => s.watchedCategories >= CATEGORIES.length },
  { id: 'important-1', icon: 'star', tone: 'yellow', title: 'Achei Ouro', text: 'Marcar 1 importante.', test: s => s.important >= 1 },
  { id: 'important-3', icon: 'star', tone: 'blue', title: 'Garimpo Bom', text: 'Ter 3 importantes.', test: s => s.important >= 3 },
  { id: 'important-10', icon: 'star', tone: 'red', title: 'Top 10 Tesouros', text: 'Ter 10 importantes.', test: s => s.important >= 10 },
  { id: 'inbox-zero', icon: 'inbox', tone: 'green', title: 'Inbox Respirando', text: 'Zerar o inbox tendo pelo menos 5 itens.', test: s => s.total >= 5 && s.inbox === 0 },
  { id: 'archive-3', icon: 'archive', tone: 'blue', title: 'Desapego Saudável', text: 'Arquivar 3 itens.', test: s => s.archived >= 3 },
  { id: 'archive-10', icon: 'archive', tone: 'purple', title: 'Curadoria Sem Culpa', text: 'Arquivar 10 itens.', test: s => s.archived >= 10 },
  { id: 'active-20', icon: 'book', tone: 'pink', title: 'Biblioteca Ativa', text: 'Manter 20 itens ativos.', test: s => s.active >= 20 },
  { id: 'short-5', icon: 'zap', tone: 'yellow', title: 'Minutinhos Valem', text: 'Ver 5 conteúdos curtos.', test: s => s.shortWatched >= 5 },
  { id: 'focus-5', icon: 'brain', tone: 'blue', title: 'Cabeça no Lugar', text: 'Ver 5 conteúdos focados.', test: s => s.focusWatched >= 5 },
  { id: 'creative-5', icon: 'palette', tone: 'pink', title: 'Faísca Criativa', text: 'Ver 5 conteúdos criativos.', test: s => s.creativeWatched >= 5 },
  { id: 'first-reflection', icon: 'lightbulb', tone: 'green', title: 'Aprendizado Registrado', text: 'Registrar a primeira reflexão.', test: s => s.reflectionCount >= 1 },
  { id: 'first-active-review', icon: 'cards', tone: 'blue', title: 'Memória em Movimento', text: 'Concluir a primeira revisão ativa.', test: s => s.reviewAttemptCount >= 1 },
  { id: 'remembered-5', icon: 'brain', tone: 'purple', title: 'Cinco Lembranças', text: 'Avaliar cinco cartões como Bom ou Fácil.', test: s => s.rememberedCount >= 5 },
  { id: 'first-real-application', icon: 'practice', tone: 'yellow', title: 'Da Ideia à Prática', text: 'Concluir a primeira aplicação real.', test: s => s.applicationsCompleted >= 1 },
  { id: 'review-week', icon: 'calendar', tone: 'pink', title: 'Semana de Recordação', text: 'Revisar por sete dias consecutivos.', test: s => s.reviewStreakDays >= 7 },
  { id: 'applied-3', icon: 'check', tone: 'red', title: 'Três Aprendizados Aplicados', text: 'Concluir três aplicações reais.', test: s => s.contentsApplied >= 3 },
  { id: 'recovered-card', icon: 'repeat', tone: 'green', title: 'Recuperei!', text: 'Lembrar um cartão que antes foi esquecido.', test: s => s.recoveredCount >= 1 },
  { id: 'path-with-application', icon: 'route', tone: 'blue', title: 'Trilha que Virou Ação', text: 'Concluir uma trilha com aplicação registrada.', test: s => s.completedPathsWithApplications >= 1 }
];

export default function App() {
  const [videos, setVideos] = useState([]);
  const [settings, setSettings] = useState(null);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authLoading, setAuthLoading] = useState(false);
  const [view, setView] = useState('home');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [input, setInput] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [recommendation, setRecommendation] = useState(DEFAULT_RECOMMENDATION);
  const [mascotInput, setMascotInput] = useState('');
  const [mascotMessages, setMascotMessages] = useState([
    { role: 'assistant', text: 'Eu sou o Guardinho. Me chama quando quiser escolher o que ver, fugir da procrastinação ou entender seus padrões de consumo.' }
  ]);
  const [mascotOpen, setMascotOpen] = useState(false);
  const [mascotBubble, setMascotBubble] = useState('Quer que eu escolha algo rápido para você revisar?');
  const [mascotLoading, setMascotLoading] = useState(false);
  const [isInstallable, setIsInstallable] = useState(false);
  const [smartSearchResults, setSmartSearchResults] = useState([]);
  const [smartSearchMeta, setSmartSearchMeta] = useState({});
  const [smartSearchLoading, setSmartSearchLoading] = useState(false);
  const [paths, setPaths] = useState([]);
  const [pathsLoading, setPathsLoading] = useState(false);
  const [selectedPathId, setSelectedPathId] = useState(null);
  const [activeReviewSession, setActiveReviewSession] = useState(null);
  const [todayData, setTodayData] = useState(null);
  const [knowledgeMetrics, setKnowledgeMetrics] = useState({});
  const [knowledgeRefreshKey, setKnowledgeRefreshKey] = useState(0);
  const [reflectionVideoId, setReflectionVideoId] = useState(null);
  const deferredPromptRef = useRef(null);
  const announcedAchievementsRef = useRef(new Set());
  const achievementsReadyRef = useRef(false);
  const pendingSharePayloadRef = useRef(null);

  const selectedVideo = useMemo(() => videos.find(video => video.id === selectedId) || null, [videos, selectedId]);
  const selectedPath = useMemo(() => paths.find(path => path.id === selectedPathId) || null, [paths, selectedPathId]);

  const activeVideos = useMemo(() => videos.filter(video => video.status !== 'arquivado'), [videos]);
  const inboxVideos = useMemo(() => videos.filter(video => video.status === 'inbox'), [videos]);
  const importantVideos = useMemo(() => videos.filter(video => video.status === 'importante'), [videos]);
  const appliedVideos = useMemo(() => videos.filter(video => video.applicationStatus === 'completed' && video.appliedAt), [videos]);
  const watchStats = useMemo(() => buildWatchStats(videos), [videos]);
  const achievementStats = useMemo(() => ({ ...watchStats, ...knowledgeMetrics }), [watchStats, knowledgeMetrics]);
  const earnedAchievements = useMemo(() => ACHIEVEMENTS.filter(achievement => achievement.test(achievementStats)), [achievementStats]);

  const dailyQueue = useMemo(() => {
    return [...videos]
      .filter(video => !['arquivado', 'aplicado'].includes(video.status))
      .sort((a, b) => {
        const priority = { alta: 0, media: 1, baixa: 2 };
        const pa = priority[a.priority] ?? 3;
        const pb = priority[b.priority] ?? 3;
        if (pa !== pb) return pa - pb;
        const ra = a.reviewedAt ? new Date(a.reviewedAt).getTime() : 0;
        const rb = b.reviewedAt ? new Date(b.reviewedAt).getTime() : 0;
        if (ra !== rb) return ra - rb;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      })
      .slice(0, settings?.dailyReviewTarget || 3);
  }, [settings?.dailyReviewTarget, videos]);

  const reviewQueue = useMemo(() => {
    const base = [...videos].filter(video => !['arquivado', 'aplicado'].includes(video.status));
    return base.sort((a, b) => {
      const aScore = scoreForReview(a);
      const bScore = scoreForReview(b);
      return bScore - aScore;
    });
  }, [videos]);

  const filteredVideos = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return videos.filter(video => {
      if (filters.category !== 'all' && video.category !== filters.category) return false;
      if (filters.status === 'active' && video.status === 'arquivado') return false;
      if (filters.status !== 'active' && filters.status !== 'all' && video.status !== filters.status) return false;
      if (filters.platform !== 'all' && (video.platform || 'tiktok') !== filters.platform) return false;
      if (filters.capsule === 'with' && !video.capsule) return false;
      if (filters.capsule === 'without' && video.capsule) return false;
      if (filters.capsule === 'complete' && video.capsule?.status !== 'completed') return false;
      if (filters.capsule === 'limited' && video.capsule?.status !== 'limited') return false;
      if (!query) return true;
      const haystack = [video.titleCustom, video.titleAi, video.titleOriginal, video.authorName, video.category, video.reason, video.note, video.summary, video.bestFor, video.watchWhen, video.mood, video.effort, video.platform, ...(video.tags || [])].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [filters, videos]);

  useEffect(() => {
    async function boot() {
      let initialVideos = [];
      let initialSettings = {};
      const params = new URLSearchParams(window.location.search);
      const sharePayload = getSharePayloadFromUrl();
      if (sharePayload.isShareTarget && sharePayload.url) {
        pendingSharePayloadRef.current = sharePayload;
      }

      try {
        if (repository.me) {
          const session = await repository.me();
          setUser(session.user);
        }
        [initialVideos, initialSettings] = await Promise.all([repository.listVideos(), repository.getSettings?.() || {}]);
      } catch (error) {
        if (error.status === 401) {
          if (pendingSharePayloadRef.current) setView('add');
          setAuthChecked(true);
          return;
        }
        showToast('API indisponível. Verifique a conexão com o backend.');
        setAuthChecked(true);
        return;
      }
      setVideos(initialVideos);
      setSettings(initialSettings);

      if (params.has('review')) setView('review');
      if (params.has('add')) setView('add');

      await consumePendingShare(initialSettings);
      setAuthChecked(true);
    }

    boot();
  }, []);

  useEffect(() => {
    const handleBeforeInstall = event => {
      event.preventDefault();
      deferredPromptRef.current = event;
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  useEffect(() => {
    if (!authChecked || !earnedAchievements.length || !repository.syncAchievements) return;
    repository.syncAchievements(earnedAchievements.map(achievement => achievement.id)).catch(() => {});
  }, [authChecked, earnedAchievements]);

  useEffect(() => {
    if (!authChecked) return;
    const earnedIds = earnedAchievements.map(achievement => achievement.id);
    if (!achievementsReadyRef.current) {
      announcedAchievementsRef.current = new Set(earnedIds);
      achievementsReadyRef.current = true;
      return;
    }
    const fresh = earnedAchievements.find(achievement => !announcedAchievementsRef.current.has(achievement.id));
    if (!fresh) return;
    fresh && announcedAchievementsRef.current.add(fresh.id);
    pushMascotMessage(`Conquista desbloqueada: ${fresh.title}. ${fresh.text}`);
  }, [authChecked, earnedAchievements]);

  useEffect(() => {
    if (!authChecked || mascotOpen) return;
    const tips = [
      'Tem 5 minutos? Eu posso escolher um item curto do seu acervo.',
      'Seu Guardei fica melhor quando você marca o que já viu.',
      'Quer um mini relatório do que você mais está consumindo?',
      'Se estiver procrastinando, me chama que eu escolho uma coisa leve.'
    ];
    const timer = window.setInterval(() => {
      setMascotBubble(tips[Math.floor(Math.random() * tips.length)]);
    }, 90000);
    return () => window.clearInterval(timer);
  }, [authChecked, mascotOpen]);

  useEffect(() => {
    if (!authChecked || !user || !['paths', 'path-details', 'map'].includes(view)) return;
    if (paths.length) return;
    loadPaths();
  }, [authChecked, user, view]);

  useEffect(() => {
    if (!authChecked || !user) return;
    let active = true;
    knowledgeService.dashboard(30).then(data => active && setKnowledgeMetrics(data.metrics || {})).catch(() => {});
    return () => { active = false; };
  }, [authChecked, user, knowledgeRefreshKey]);

  async function loadPaths() {
    setPathsLoading(true);
    try {
      const data = await pathService.list();
      setPaths(data.paths || []);
      return data.paths || [];
    } catch (error) {
      showToast(error.message || 'Não foi possível carregar as trilhas');
      return [];
    } finally {
      setPathsLoading(false);
    }
  }

  async function handleSmartSearch(params) {
    setSmartSearchLoading(true);
    try {
      const data = await searchLibrary(params);
      setSmartSearchResults(data.results || []);
      setSmartSearchMeta(data);
    } catch (error) {
      showToast(error.message || 'Busca inteligente indisponível');
      setSmartSearchResults([]);
      setSmartSearchMeta({ query: params.q, mode: 'textual_fallback', total: 0 });
    } finally {
      setSmartSearchLoading(false);
    }
  }

  function clearSmartSearch() {
    setSmartSearchResults([]);
    setSmartSearchMeta({});
  }

  async function createLearningPath(payload) {
    setPathsLoading(true);
    try {
      const data = await pathService.create(payload);
      setPaths(current => [data.path, ...current.filter(path => path.id !== data.path.id)]);
      setSelectedPathId(data.path.id);
      setView('path-details');
      showToast(data.path.items?.length ? 'Trilha criada e organizada' : 'Trilha criada; lacunas foram identificadas');
      return data.path;
    } catch (error) {
      showToast(error.message || 'Não foi possível criar a trilha');
      return null;
    } finally {
      setPathsLoading(false);
    }
  }

  async function refreshLearningPath(pathId = selectedPathId) {
    if (!pathId) return null;
    const data = await pathService.get(pathId);
    setPaths(current => current.map(path => path.id === pathId ? data.path : path));
    return data.path;
  }

  async function updateLearningPath(patch) {
    try {
      const data = await pathService.update(selectedPathId, patch);
      setPaths(current => current.map(path => path.id === selectedPathId ? data.path : path));
      showToast('Trilha atualizada');
      return data.path;
    } catch (error) { showToast(error.message); return null; }
  }

  async function updateLearningPathItem(itemId, patch) {
    try {
      const data = await pathService.updateItem(selectedPathId, itemId, patch);
      setPaths(current => current.map(path => path.id === selectedPathId ? data.path : path));
    } catch (error) { showToast(error.message); }
  }

  async function removeLearningPathItem(itemId) {
    try { await pathService.removeItem(selectedPathId, itemId); await refreshLearningPath(); } catch (error) { showToast(error.message); }
  }

  async function reorderLearningPath(items) {
    try {
      const data = await pathService.reorder(selectedPathId, items);
      setPaths(current => current.map(path => path.id === selectedPathId ? data.path : path));
    } catch (error) { showToast(error.message); }
  }

  async function reorganizeLearningPath() {
    setPathsLoading(true);
    try {
      const data = await pathService.reorganize(selectedPathId);
      setPaths(current => current.map(path => path.id === selectedPathId ? data.path : path));
      showToast('Trilha reorganizada sem remover suas alterações manuais');
    } catch (error) { showToast(error.message); } finally { setPathsLoading(false); }
  }

  async function addLearningPathItem(payload) {
    try {
      const data = await pathService.addItem(selectedPathId, payload);
      setPaths(current => current.map(path => path.id === selectedPathId ? data.path : path));
      showToast('Conteúdo adicionado à trilha');
    } catch (error) { showToast(error.message); }
  }

  async function updateLearningPathGap(gapId, patch) {
    try {
      const data = await pathService.updateGap(selectedPathId, gapId, patch);
      setPaths(current => current.map(path => path.id === selectedPathId ? data.path : path));
    } catch (error) { showToast(error.message); }
  }

  async function duplicateLearningPath() {
    try {
      const data = await pathService.duplicate(selectedPathId);
      setPaths(current => [data.path, ...current]);
      showToast('Trilha duplicada');
    } catch (error) { showToast(error.message); }
  }

  async function deleteLearningPath() {
    try {
      await pathService.remove(selectedPathId);
      setPaths(current => current.filter(path => path.id !== selectedPathId));
      setSelectedPathId(null);
      setView('paths');
      showToast('Trilha excluída');
    } catch (error) { showToast(error.message); }
  }

  function showToast(message) {
    setToast(message);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(''), 2400);
  }

  async function loadVaultData() {
    const [nextVideos, nextSettings] = await Promise.all([repository.listVideos(), repository.getSettings?.() || {}]);
    setVideos(nextVideos);
    setSettings(nextSettings);
    return { videos: nextVideos, settings: nextSettings };
  }

  async function handleAuth(event) {
    event?.preventDefault();
    setAuthLoading(true);
    try {
      const action = authMode === 'register' ? repository.register : repository.login;
      const result = await action.call(repository, authForm);
      setUser(result.user);
      const data = await loadVaultData();
      const shared = await consumePendingShare(data.settings);
      if (!shared) showToast(authMode === 'register' ? 'Conta criada com sucesso' : 'Bem-vindo!');
    } catch (error) {
      showToast(error.payload?.message || 'Não foi possível autenticar');
    } finally {
      setAuthLoading(false);
    }
  }

  async function logout() {
    await repository.logout?.();
    setUser(null);
    setVideos([]);
    setSettings(null);
    setSelectedId(null);
    setSelectedPathId(null);
    setPaths([]);
    clearSmartSearch();
    setView('home');
    showToast('Sessão encerrada');
  }

  async function syncVideos(nextVideos) {
    setVideos(nextVideos);
    await repository.saveVideos?.(nextVideos);
  }

  async function consumePendingShare(settingsOverride = settings) {
    const payload = pendingSharePayloadRef.current;
    if (!payload?.isShareTarget || !payload.url) return false;

    pendingSharePayloadRef.current = null;
    const saved = await saveAuto({ url: payload.url, text: payload.sourceText, title: payload.title, origin: 'share-target', silent: true });
    if (!saved) {
      pendingSharePayloadRef.current = payload;
      return false;
    }
    await loadVaultData();
    window.history.replaceState({}, document.title, '/');
    showToast('Link salvo com sucesso');
    if (settingsOverride?.autoOpenReviewAfterShare) setView('review');
    return true;
  }

  async function saveAuto({ url, text = '', title = '', origin = 'manual', silent = false }) {
    const finalUrl = extractSupportedVideoUrl(url || text || title);
    if (!finalUrl) {
      if (!silent) showToast('Cole um link válido');
      return null;
    }

    const alreadyExists = videos.find(video => video.url === finalUrl || video.canonicalUrl === finalUrl);
    if (alreadyExists) {
      if (!silent) {
        setSelectedId(alreadyExists.id);
        showToast('Este item já está salvo');
      }
      return alreadyExists;
    }

    setIsSaving(true);
    try {
      const video = await buildAutoVideo({ url: finalUrl, text, title, origin });
      const result = await repository.addVideo(video);
      const savedVideo = result?.video || video;
      const nextVideos = result?.duplicated ? await repository.listVideos() : [savedVideo, ...videos];
      setVideos(nextVideos);
      setInput('');
      setManualTitle('');
      setSourceText('');
      setSelectedId(savedVideo.id);
      if (!silent) showToast(video.status === 'inbox' ? 'Item salvo no Inbox' : 'Item organizado com sucesso');
      return result?.video || video;
    } catch (error) {
      showToast('Não foi possível salvar no momento');
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmit(event) {
    event?.preventDefault();
    await saveAuto({ url: input, text: sourceText, title: manualTitle, origin: 'manual' });
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      const url = extractSupportedVideoUrl(text);
      if (!url) {
      showToast('Nenhum link válido encontrado no clipboard');
        return;
      }
      await saveAuto({ url, text, origin: 'clipboard' });
    } catch {
      showToast('Não foi possível acessar o clipboard');
    }
  }

  async function updateVideo(id, patch) {
    const updated = await repository.updateVideo(id, patch);
    const saved = updated?.video || updated;
    const next = videos.map(video => video.id === id ? { ...video, ...patch, ...(saved || {}), updatedAt: saved?.updatedAt || new Date().toISOString() } : video);
    setVideos(next);
    return saved;
  }

  function refreshKnowledgeCycle() {
    setKnowledgeRefreshKey(value => value + 1);
  }

  function updateVideoCapsule(id, capsule) {
    setVideos(current => current.map(video => video.id === id ? { ...video, capsule } : video));
  }

  async function deleteVideo(id) {
    await repository.deleteVideo(id);
    setVideos(videos.filter(video => video.id !== id));
    if (selectedId === id) setSelectedId(null);
    showToast('Item removido');
  }

  async function markReview(id, status) {
    const patch = {
      status,
      reviewedAt: new Date().toISOString(),
      reviewCount: (videos.find(video => video.id === id)?.reviewCount || 0) + 1
    };
    await updateVideo(id, patch);
    setReviewIndex(index => Math.min(index + 1, Math.max(reviewQueue.length - 1, 0)));
    showToast(STATUS[status]?.label || 'Atualizado');
  }

  async function markConsumed(id, minutes = 5, { advanceReview = false } = {}) {
    const current = videos.find(video => video.id === id);
    const consumedAt = new Date().toISOString();
    const watchedSeconds = Math.max(0, Number(minutes || 0) * 60);
    await updateVideo(id, {
      consumedAt,
      watchedAt: consumedAt,
      watchedSeconds,
      watchCount: (current?.watchCount || 0) + 1,
      ...(advanceReview ? { reviewedAt: consumedAt, reviewCount: (current?.reviewCount || 0) + 1 } : {})
    });
    setReflectionVideoId(id);
    setSelectedId(id);
    if (advanceReview) setReviewIndex(index => Math.min(index + 1, Math.max(reviewQueue.length - 1, 0)));
    refreshKnowledgeCycle();
    pushMascotMessage(`Boa. "${getDisplayTitle(current)}" foi registrado como consumido. Aplicar é uma etapa separada — quer anotar rapidamente o que aprendeu?`);
    showToast('Conteúdo marcado como consumido');
  }

  function startCardReview(session) {
    setActiveReviewSession(session || { minutes: 5, cards: [] });
    setView('card-review');
  }

  async function openPathFromToday(pathId) {
    if (!paths.some(path => path.id === pathId)) await loadPaths();
    setSelectedPathId(pathId);
    setView('path-details');
  }

  function openApplicationsFromToday(videoId) {
    if (videoId) setSelectedId(videoId);
    else showToast('Abra um conteúdo para criar uma aplicação concreta.');
  }

  function pushMascotMessage(text) {
    setMascotBubble(text);
    setMascotMessages(messages => [...messages, { role: 'assistant', text }].slice(-10));
  }

  async function sendMascotMessage(event) {
    event?.preventDefault();
    const text = mascotInput.trim();
    if (!text) return;
    const nextMessages = [...mascotMessages, { role: 'user', text }].slice(-10);
    setMascotMessages(nextMessages);
    setMascotInput('');
    setMascotLoading(true);
    try {
      const answer = await chatWithMascot({
        message: text,
        messages: nextMessages,
        videos,
        stats: watchStats
      });
      setMascotBubble(answer);
      setMascotMessages(messages => [...messages, { role: 'assistant', text: answer }].slice(-10));
    } catch {
      const answer = buildMascotAnswer(text, videos, watchStats);
      setMascotBubble(answer);
      setMascotMessages(messages => [...messages, { role: 'assistant', text: answer }].slice(-10));
    } finally {
      setMascotLoading(false);
    }
  }

  function openVideo(video) {
    if (!video?.url) return;
    window.open(video.url, '_blank', 'noopener,noreferrer');
  }

  function randomVideo(preferences = recommendation) {
    const pool = buildRecommendationPool(activeVideos.length ? activeVideos : videos, preferences);
    if (!pool.length) {
      showToast('Nenhum item corresponde a esses critérios');
      return;
    }
    const topScore = pool[0].score;
    const best = pool.filter(item => item.score >= topScore - 2).slice(0, 8);
    const video = best[Math.floor(Math.random() * best.length)].video;
    setSelectedId(video.id);
  }

  async function installApp() {
    if (!deferredPromptRef.current) return;
    deferredPromptRef.current.prompt();
    await deferredPromptRef.current.userChoice;
    deferredPromptRef.current = null;
    setIsInstallable(false);
  }

  async function exportJson() {
    const payload = exportVault(videos, settings || {});
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `guardei-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast('Backup exportado com sucesso');
  }

  async function importJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const incoming = importVaultPayload(JSON.parse(text));
      const byUrl = new Map(videos.map(video => [video.url, video]));
      incoming.forEach(video => byUrl.set(video.url, { ...video, id: video.id || crypto.randomUUID() }));
      const next = [...byUrl.values()].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      await syncVideos(next);
      showToast('Backup importado com sucesso');
    } catch {
      showToast('Arquivo inválido');
    } finally {
      event.target.value = '';
    }
  }

  async function updateSettings(patch) {
    const next = { ...(settings || {}), ...patch };
    setSettings(next);
    await repository.saveSettings?.(next);
  }

  const reviewVideo = reviewQueue[Math.min(reviewIndex, Math.max(reviewQueue.length - 1, 0))];

  if (!authChecked) {
    return (
      <div className="app-shell auth-shell">
        <Ambient />
        <section className="center-view">
          <EmptyState title="Carregando sessao" text="Validando seu acesso." />
        </section>
      </div>
    );
  }

  if (repository.me && !user) {
    return (
      <div className="app-shell auth-shell">
        <Ambient />
        <AuthView
          mode={authMode}
          setMode={setAuthMode}
          form={authForm}
          setForm={setAuthForm}
          onSubmit={handleAuth}
          loading={authLoading}
        />
        <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Ambient />
      <header className="topbar">
        <button className="brand logo-only" onClick={() => setView('home')} aria-label="Ir para a home">
          <img className="brand-logo" src={guardeiLogo} width="300" height="300" alt="Guardei" />
          <span className="brand-title">
            <strong>GUARDEI</strong>
            <small>Acervo Inteligente</small>
          </span>
        </button>

        <nav className="desktop-nav">
          <NavButton active={view === 'home'} onClick={() => setView('home')}>Home</NavButton>
          <NavButton active={view === 'review'} onClick={() => setView('review')}>Revisar</NavButton>
          <NavButton active={view === 'library'} onClick={() => setView('library')}>Biblioteca</NavButton>
          <NavButton active={view === 'paths' || view === 'path-details'} onClick={() => setView('paths')}>Trilhas</NavButton>
          <NavButton active={view === 'map'} onClick={() => setView('map')}>Mapa</NavButton>
          <NavButton active={view === 'dashboard'} onClick={() => setView('dashboard')}>Dashboard</NavButton>
          <NavButton active={view === 'achievements'} onClick={() => setView('achievements')}>Conquistas</NavButton>
          <NavButton active={view === 'settings'} onClick={() => setView('settings')}>Configurações</NavButton>
        </nav>

        <div className="top-actions">
          {!!todayData?.counts?.dueCards && <button className="count-pill review-count-pill" onClick={() => startCardReview({ minutes: 5, cards: todayData.cards || [] })} aria-label={`${todayData.counts.dueCards} cartões pendentes para revisar`}>{todayData.counts.dueCards} para recordar</button>}
          <span className="count-pill">{videos.length} itens salvos</span>
          {user && (
            <div className="user-menu">
              <span className="user-name">{user.name || user.email}</span>
            </div>
          )}
          <button className="primary-btn-small" onClick={() => setView('add')}>+ Salvar Link</button>
        </div>
      </header>

      <main>
        {view === 'home' && (
          <HomeView
            videos={videos}
            dailyQueue={dailyQueue}
            inboxVideos={inboxVideos}
            importantVideos={importantVideos}
            appliedVideos={appliedVideos}
            setView={setView}
            setSelectedId={setSelectedId}
            randomVideo={randomVideo}
            recommendation={recommendation}
            setRecommendation={setRecommendation}
            isInstallable={isInstallable}
            installApp={installApp}
            pasteFromClipboard={pasteFromClipboard}
            knowledgeRefreshKey={knowledgeRefreshKey}
            onStartReview={startCardReview}
            onOpenPath={openPathFromToday}
            onOpenApplications={openApplicationsFromToday}
            onTodayData={setTodayData}
            onNotify={showToast}
          />
        )}

        {view === 'add' && (
          <AddView
            input={input}
            manualTitle={manualTitle}
            sourceText={sourceText}
            setInput={setInput}
            setManualTitle={setManualTitle}
            setSourceText={setSourceText}
            handleSubmit={handleSubmit}
            pasteFromClipboard={pasteFromClipboard}
            isSaving={isSaving}
          />
        )}

        {view === 'review' && (
          <ReviewView
            video={reviewVideo}
            queueLength={reviewQueue.length}
            reviewIndex={reviewIndex}
            setReviewIndex={setReviewIndex}
            markReview={markReview}
            markConsumed={markConsumed}
            openVideo={openVideo}
            setSelectedId={setSelectedId}
            randomVideo={randomVideo}
          />
        )}

        {view === 'card-review' && (
          <CardReviewSession
            initialCards={activeReviewSession?.cards || []}
            minutes={activeReviewSession?.minutes || 5}
            onClose={() => { setActiveReviewSession(null); setView('home'); refreshKnowledgeCycle(); }}
            onOpenVideo={setSelectedId}
            onChanged={refreshKnowledgeCycle}
            onNotify={showToast}
          />
        )}

        {view === 'library' && (
          <LibraryView
            videos={filteredVideos}
            total={videos.length}
            filters={filters}
            setFilters={setFilters}
            setSelectedId={setSelectedId}
            deleteVideo={deleteVideo}
            smartResults={smartSearchResults}
            smartMeta={smartSearchMeta}
            smartLoading={smartSearchLoading}
            onSmartSearch={handleSmartSearch}
            onClearSmartSearch={clearSmartSearch}
          />
        )}

        {view === 'paths' && (
          <PathsView paths={paths} loading={pathsLoading} categories={CATEGORIES} onCreate={createLearningPath} onOpen={id => { setSelectedPathId(id); setView('path-details'); }} />
        )}

        {view === 'path-details' && selectedPath && (
          <PathDetails
            path={selectedPath}
            videos={videos}
            loading={pathsLoading}
            onBack={() => setView('paths')}
            onOpenVideo={setSelectedId}
            onUpdate={updateLearningPath}
            onUpdateItem={updateLearningPathItem}
            onRemoveItem={removeLearningPathItem}
            onReorder={reorderLearningPath}
            onReorganize={reorganizeLearningPath}
            onDuplicate={duplicateLearningPath}
            onDelete={deleteLearningPath}
            onAddItem={addLearningPathItem}
            onUpdateGap={updateLearningPathGap}
            onTalk={() => { setMascotInput(`O que eu deveria fazer agora na trilha ${selectedPath.title}?`); setMascotOpen(true); }}
          />
        )}

        {view === 'map' && (
          <KnowledgeMap categories={CATEGORIES} paths={paths} onOpenItem={setSelectedId} />
        )}

        {view === 'dashboard' && (
          <DashboardView videos={videos} stats={achievementStats} setSelectedId={setSelectedId} openMascot={() => setMascotOpen(true)} knowledgeRefreshKey={knowledgeRefreshKey} onMetrics={setKnowledgeMetrics} onNotify={showToast} />
        )}

        {view === 'achievements' && (
          <AchievementsView achievements={ACHIEVEMENTS} earned={earnedAchievements} stats={achievementStats} />
        )}

        {view === 'settings' && (
          <SettingsView
            settings={settings || {}}
            updateSettings={updateSettings}
            exportJson={exportJson}
            importJson={importJson}
            videos={videos}
            user={user}
            logout={logout}
          />
        )}
      </main>

      <MobileDock view={view} setView={setView} />

      {selectedVideo && (
        <VideoModal
          video={selectedVideo}
          onClose={() => setSelectedId(null)}
          onUpdate={patch => updateVideo(selectedVideo.id, patch)}
          onDelete={() => deleteVideo(selectedVideo.id)}
          onOpen={() => openVideo(selectedVideo)}
          onMarkConsumed={markConsumed}
          reflectionExpanded={reflectionVideoId === selectedVideo.id}
          paths={paths}
          onKnowledgeChanged={() => { refreshKnowledgeCycle(); loadVaultData(); }}
          onCapsuleChange={capsule => updateVideoCapsule(selectedVideo.id, capsule)}
          onNotify={showToast}
          onOpenRelated={setSelectedId}
        />
      )}

      <FloatingMascot
        open={mascotOpen}
        setOpen={setMascotOpen}
        bubble={mascotBubble}
        messages={mascotMessages}
        input={mascotInput}
        setInput={setMascotInput}
        onSubmit={sendMascotMessage}
        loading={mascotLoading}
        randomVideo={randomVideo}
        onDismissBubble={() => setMascotBubble('')}
      />

      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  );
}

function Ambient() {
  return (
    <div className="ambient" aria-hidden="true">
      <span className="orb orb-a" />
      <span className="orb orb-b" />
      <span className="orb orb-c" />
      <span className="grid-bg" />
    </div>
  );
}

function NavButton({ active, children, ...props }) {
  return <button className={`nav-btn ${active ? 'active' : ''}`} {...props}>{children}</button>;
}

function AuthView({ mode, setMode, form, setForm, onSubmit, loading }) {
  const isRegister = mode === 'register';
  return (
    <section className="auth-view">
      <div className="auth-card">
        <span className="eyebrow">Acesso Seguro</span>
        <h1>{isRegister ? 'Crie sua Conta' : 'Acesse seu Acervo'}</h1>
        <p>Organize, encontre e revise o melhor conteúdo da internet em um único lugar. Cada conta é privada e segura.</p>

        <form className="auth-form" onSubmit={onSubmit}>
          {isRegister && (
            <input
              value={form.name}
              onChange={event => setForm({ ...form, name: event.target.value })}
              placeholder="Seu nome"
              autoComplete="name"
            />
          )}
          <input
            type="email"
            value={form.email}
            onChange={event => setForm({ ...form, email: event.target.value })}
            placeholder="Email"
            autoComplete="email"
            required
          />
          <input
            type="password"
            value={form.password}
            onChange={event => setForm({ ...form, password: event.target.value })}
            placeholder="Senha"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            minLength={8}
            required
          />
          <button className="primary-btn" type="submit" disabled={loading}>
            {loading ? 'Processando...' : isRegister ? 'Criar Conta' : 'Acessar'}
          </button>
        </form>

        <button className="auth-switch" type="button" onClick={() => setMode(isRegister ? 'login' : 'register')}>
          {isRegister ? 'Já tenho conta' : 'Criar nova conta'}
        </button>
      </div>
    </section>
  );
}

function HomeView({ videos, dailyQueue, inboxVideos, importantVideos, appliedVideos, setView, setSelectedId, randomVideo, recommendation, setRecommendation, isInstallable, installApp, pasteFromClipboard, knowledgeRefreshKey, onStartReview, onOpenPath, onOpenApplications, onTodayData, onNotify }) {
  return (
    <section className="view-stack">
      <div className="hero-panel">
        <div>
          <span className="eyebrow">Bem-vindo ao Guardei</span>
          <h1>Organize e redescubra o melhor da web.</h1>
          <p>Salve links, vídeos, artigos e ideias. A IA ajuda a organizar, categorizar e sugerir o que encaixa perfeitamente com seu tempo livre.</p>
        </div>
        <div className="hero-actions">
          <button className="primary-btn" onClick={() => setView('add')}>Salvar Link</button>
          <button className="secondary-btn" onClick={pasteFromClipboard}>Colar do Clipboard</button>
          {isInstallable && <button className="secondary-btn" onClick={installApp}>Instalar App</button>}
        </div>
      </div>

      <TodayHub
        refreshKey={knowledgeRefreshKey}
        onStartReview={onStartReview}
        onOpenVideo={setSelectedId}
        onOpenPath={onOpenPath}
        onOpenApplications={onOpenApplications}
        onNotify={onNotify}
        onData={onTodayData}
      />

      <div className="stats-grid">
        <StatCard label="No acervo" value={videos.length} icon="book" />
        <StatCard label="Inbox" value={inboxVideos.length} icon="inbox" tone={inboxVideos.length ? 'warn' : ''} />
        <StatCard label="Importantes" value={importantVideos.length} icon="star" />
        <StatCard label="Aplicados" value={appliedVideos.length} icon="check" />
      </div>

      <div className="split-layout">
        <Panel title="Para revisar hoje" action={<button onClick={() => setView('review')}>Revisar</button>}>
          {dailyQueue.length ? (
            <div className="daily-list">
              {dailyQueue.map(video => <CompactVideoRow key={video.id} video={video} onClick={() => setSelectedId(video.id)} />)}
            </div>
          ) : <EmptyState title="Sem itens pendentes" text="Salve um link para começar a revisar." />}
        </Panel>

        <Panel title="Não sei o que assistir" action={<button onClick={() => randomVideo(recommendation)}>Sortear</button>}>
          <div className="smart-picker">
            <div className="select-caption">
              <span><IconSymbol name="clock" /> Tempo</span>
              <span><IconSymbol name="smile" /> Mood</span>
              <span><IconSymbol name="source" /> Fonte</span>
            </div>
            <select value={recommendation.time} onChange={event => setRecommendation({ ...recommendation, time: event.target.value })}>
              <option value="any">Qualquer duração</option>
              <option value="short">2 a 5 minutos</option>
              <option value="medium">10 a 20 minutos</option>
              <option value="long">Com calma</option>
            </select>
            <select value={recommendation.mood} onChange={event => setRecommendation({ ...recommendation, mood: event.target.value })}>
              <option value="any">Qualquer humor</option>
              <option value="leve">Leve</option>
              <option value="focado">Focado</option>
              <option value="criativo">Criativo</option>
            </select>
            <select value={recommendation.platform} onChange={event => setRecommendation({ ...recommendation, platform: event.target.value })}>
              <option value="all">Todas as fontes</option>
              {PLATFORM_OPTIONS.map(platform => <option key={platform.id} value={platform.id}>{platform.label}</option>)}
            </select>
          </div>
          <div
            className="roulette-card"
            onClick={() => randomVideo(recommendation)}
            onKeyDown={event => {
              if (!['Enter', ' '].includes(event.key)) return;
              event.preventDefault();
              randomVideo(recommendation);
            }}
            role="button"
            tabIndex={0}
            aria-label="Sortear uma recomendação do acervo"
          >
            <IconSymbol name="star" />
            <strong>Deixa a IA escolher</strong>
            <small>baseado em tempo livre, humor e energia mental</small>
          </div>
        </Panel>
      </div>

      {videos.some(video => video.capsule && ['completed', 'limited'].includes(video.capsule.status)) && (
        <Panel title="Conhecimento recém-extraído">
          <div className="capsule-preview-list">
            {[...videos]
              .filter(video => video.capsule && ['completed', 'limited'].includes(video.capsule.status))
              .sort((a, b) => new Date(b.capsule.generatedAt || b.capsule.updatedAt || 0) - new Date(a.capsule.generatedAt || a.capsule.updatedAt || 0))
              .slice(0, 3)
              .map(video => <CapsulePreviewRow key={video.id} video={video} onClick={() => setSelectedId(video.id)} />)}
          </div>
        </Panel>
      )}

      <Panel title="Fontes favoritas">
        <div className="platform-wall">
          {PLATFORM_OPTIONS.slice(0, 13).map(platform => (
            <span key={platform.id} className="platform-token">
              <PlatformLogo platform={platform.id} />
              {platform.label}
            </span>
          ))}
        </div>
      </Panel>

      <Panel title="Mundos">
        <div className="category-worlds">
          {CATEGORIES.map(category => {
            const count = videos.filter(video => video.category === category.id).length;
            return (
              <button key={category.id} className="world-card" style={{ '--accent': category.accent, background: category.accent }} onClick={() => { setView('library'); }}>
          <IconSymbol name={category.icon} />
          <strong>{category.label}</strong>
          <small>{count} itens</small>
              </button>
            );
          })}
        </div>
      </Panel>
    </section>
  );
}

function AddView({ input, manualTitle, sourceText, setInput, setManualTitle, setSourceText, handleSubmit, pasteFromClipboard, isSaving }) {
  return (
    <section className="add-view">
      <div className="add-card">
        <span className="eyebrow">Novo Item</span>
        <h2>Cole qualquer link que queira guardar.</h2>
        <p>Suportamos vídeos, artigos, posts, repositórios, cursos e muito mais. A IA organiza e categoriza sem reescrever seu título ou suas notas.</p>

        <form onSubmit={handleSubmit} className="smart-form">
          <label className="field-item">
            <span><IconSymbol name="link" /> Link do conteúdo</span>
            <input
              value={input}
              onChange={event => setInput(event.target.value)}
              placeholder="Ex: https://youtube.com/watch?v=..."
              autoFocus
            />
          </label>
          <label className="field-item">
            <span><IconSymbol name="edit" /> Título que você quer ver no acervo</span>
            <input
              value={manualTitle}
              onChange={event => setManualTitle(event.target.value)}
              placeholder="Ex: Aula boa de React para rever"
            />
          </label>
          <label className="field-item">
            <span><IconSymbol name="bookmark" /> Suas notas</span>
            <textarea
              value={sourceText}
              onChange={event => setSourceText(event.target.value)}
              placeholder="Ex: salvei para aplicar no projeto, ver depois com calma..."
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="primary-btn" disabled={isSaving}>{isSaving ? 'Processando...' : 'Guardar'}</button>
            <button type="button" className="secondary-btn" onClick={pasteFromClipboard}>Colar do Clipboard</button>
          </div>
        </form>
      </div>

    </section>
  );
}

function ReviewView({ video, queueLength, reviewIndex, setReviewIndex, markReview, markConsumed, openVideo, setSelectedId, randomVideo }) {
  if (!video) {
    return (
      <section className="center-view">
        <EmptyState title="Revisão completa" text="Todos os itens foram revisados!" />
        <button className="primary-btn" onClick={randomVideo}>Sortear um item</button>
      </section>
    );
  }

  return (
    <section className="review-view">
      <div className="review-top">
        <span className="eyebrow">Revisão Diária</span>
        <strong>{Math.min(reviewIndex + 1, queueLength)} / {queueLength}</strong>
      </div>

      <VideoCard video={video} big onClick={() => setSelectedId(video.id)} />

      <div className="review-actions">
        <button onClick={() => markReview(video.id, 'arquivado')}>Arquivar</button>
        <button onClick={() => markReview(video.id, 'rever')}>Rever Depois</button>
        <button className="open" onClick={() => openVideo(video)}>Abrir</button>
        <button onClick={() => markReview(video.id, 'importante')}>Importante</button>
        <button onClick={() => markConsumed(video.id, Math.max(5, Math.round((video.watchedSeconds || 0) / 60) || 5), { advanceReview: true })}>Marcar consumido</button>
      </div>

      <div className="review-nav">
        <button onClick={() => setReviewIndex(Math.max(reviewIndex - 1, 0))}>← anterior</button>
        <button onClick={() => setReviewIndex(Math.min(reviewIndex + 1, queueLength - 1))}>próximo →</button>
      </div>
    </section>
  );
}

function LibraryView({ videos, total, filters, setFilters, setSelectedId, deleteVideo, smartResults, smartMeta, smartLoading, onSmartSearch, onClearSmartSearch }) {
  return (
    <section className="view-stack">
      <div className="library-head">
        <div>
          <span className="eyebrow">Biblioteca</span>
          <h2>{videos.length} de {total} itens</h2>
        </div>
        <span className="library-search-caption">Busca literal e inteligente disponíveis abaixo</span>
      </div>

      <SmartSearch categories={CATEGORIES} platforms={PLATFORM_OPTIONS} onSearch={onSmartSearch} results={smartResults} loading={smartLoading} meta={smartMeta} onOpenItem={setSelectedId} onClear={onClearSmartSearch} />

      <details className="literal-search-panel"><summary>Busca textual simples e filtros rápidos</summary>
      <label className="literal-search-field"><span>Buscar literalmente</span><input className="search-input" value={filters.query} onChange={event => setFilters({ ...filters, query: event.target.value })} placeholder="Título, tag ou nota exata..." /></label>

      <div className="filter-strip">
        <FilterChip active={filters.category === 'all'} onClick={() => setFilters({ ...filters, category: 'all' })}>Todos</FilterChip>
        {CATEGORIES.map(category => (
          <FilterChip key={category.id} active={filters.category === category.id} onClick={() => setFilters({ ...filters, category: category.id })}>{category.label}</FilterChip>
        ))}
      </div>

      <div className="filter-strip compact">
        <FilterChip active={filters.status === 'active'} onClick={() => setFilters({ ...filters, status: 'active' })}>Ativos</FilterChip>
        <FilterChip active={filters.status === 'all'} onClick={() => setFilters({ ...filters, status: 'all' })}>Todos</FilterChip>
        {Object.entries(STATUS).map(([id, status]) => (
          <FilterChip key={id} active={filters.status === id} onClick={() => setFilters({ ...filters, status: id })}>{status.label}</FilterChip>
        ))}
      </div>

      <div className="filter-strip compact">
        <FilterChip active={filters.platform === 'all'} onClick={() => setFilters({ ...filters, platform: 'all' })}>Todas as fontes</FilterChip>
        {PLATFORM_OPTIONS.map(platform => (
          <FilterChip key={platform.id} active={filters.platform === platform.id} onClick={() => setFilters({ ...filters, platform: platform.id })}>
            <PlatformLogo platform={platform.id} compact /> {platform.label}
          </FilterChip>
        ))}
      </div>

      <div className="filter-strip compact" aria-label="Filtros de cápsula">
        <FilterChip active={filters.capsule === 'all'} onClick={() => setFilters({ ...filters, capsule: 'all' })}>Todas as análises</FilterChip>
        <FilterChip active={filters.capsule === 'with'} onClick={() => setFilters({ ...filters, capsule: 'with' })}>Com cápsula</FilterChip>
        <FilterChip active={filters.capsule === 'without'} onClick={() => setFilters({ ...filters, capsule: 'without' })}>Sem cápsula</FilterChip>
        <FilterChip active={filters.capsule === 'complete'} onClick={() => setFilters({ ...filters, capsule: 'complete' })}>Análise completa</FilterChip>
        <FilterChip active={filters.capsule === 'limited'} onClick={() => setFilters({ ...filters, capsule: 'limited' })}>Análise limitada</FilterChip>
      </div>
      </details>

      {videos.length ? (
        <div className="video-grid">
          {videos.map(video => <VideoCard key={video.id} video={video} onClick={() => setSelectedId(video.id)} onDelete={() => deleteVideo(video.id)} />)}
        </div>
      ) : <EmptyState title="Nenhum item encontrado" text="Tente limpar os filtros ou salvar um novo link." />}
    </section>
  );
}

function DashboardView({ videos, stats, setSelectedId, openMascot, knowledgeRefreshKey, onMetrics, onNotify }) {
  const topCategories = [...stats.byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const recentWatched = videos.filter(video => video.consumedAt || video.watchedAt).sort((a, b) => new Date(b.consumedAt || b.watchedAt) - new Date(a.consumedAt || a.watchedAt)).slice(0, 5);

  return (
    <section className="view-stack">
      <KnowledgeDashboard categories={CATEGORIES} refreshKey={knowledgeRefreshKey} onMetrics={onMetrics} onNotify={onNotify} />
      <div className="legacy-dashboard-section">
        <span className="eyebrow">Consumo do acervo</span>
        <h2>Histórico complementar</h2>
      </div>
      <div className="stats-grid">
        <StatCard label="Conteúdos consumidos" value={stats.watched} icon="eye" />
        <StatCard label="Tempo assistido" value={`${Math.round(stats.minutes)}min`} icon="clock" />
        <StatCard label="Categorias vistas" value={stats.watchedCategories} icon="palette" />
        <StatCard label="Conquistas" value={ACHIEVEMENTS.filter(item => item.test(stats)).length} icon="trophy" />
      </div>

      <div className="split-layout">
        <Panel title="Relatório de consumo" action={<button onClick={openMascot}>Conversar com IA</button>}>
          <div className="report-list">
            {topCategories.length ? topCategories.map(([categoryId, count]) => {
              const category = CATEGORY_BY_ID[categoryId] || CATEGORY_BY_ID.misc;
              return (
                <div key={categoryId} className="report-row">
                  <span><IconSymbol name={category.icon} /> {category.label}</span>
                  <strong>{count}</strong>
                </div>
              );
            }) : <EmptyState title="Sem histórico ainda" text="Marque itens como consumidos para gerar seu relatório." />}
          </div>
        </Panel>

        <Panel title="Consumidos recentemente">
          <div className="daily-list">
            {recentWatched.length ? recentWatched.map(video => (
              <CompactVideoRow key={video.id} video={video} onClick={() => setSelectedId(video.id)} />
            )) : <EmptyState title="Nada consumido ainda" text="Abra um item e marque como consumido." />}
          </div>
        </Panel>
      </div>
    </section>
  );
}

function AchievementsView({ achievements, earned, stats }) {
  const earnedIds = new Set(earned.map(item => item.id));
  return (
    <section className="view-stack">
      <div className="hero-panel compact-hero">
        <div>
          <span className="eyebrow">Conquistas</span>
          <h2>{earned.length} de {achievements.length} desbloqueadas</h2>
          <p>Metas fofas para transformar o Guardei em um acervo que você realmente revisita.</p>
        </div>
      </div>
      <div className="achievement-grid">
        {achievements.map(achievement => {
          const unlocked = earnedIds.has(achievement.id);
          return (
            <article key={achievement.id} className={`achievement-card tone-${achievement.tone || 'green'} ${unlocked ? 'unlocked' : ''}`}>
              <span className="achievement-icon"><IconSymbol name={achievement.icon} /></span>
              <strong>{achievement.title}</strong>
              <small>{achievement.text}</small>
              <em>{unlocked ? 'Desbloqueada' : progressHint(achievement, stats)}</em>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function FloatingMascot({ open, setOpen, bubble, messages, input, setInput, onSubmit, loading, randomVideo, onDismissBubble }) {
  return (
    <div className={`floating-mascot ${open ? 'open' : ''}`}>
      {!open && bubble && (
        <div className="mascot-speech-wrap">
          <button className="mascot-speech-close" type="button" onClick={onDismissBubble} aria-label="Fechar mensagem do Guardinho">×</button>
          <button className="mascot-speech" onClick={() => setOpen(true)}>
            {bubble}
          </button>
        </div>
      )}
      {open && (
        <section className="mascot-popup" aria-label="Chat com o Guardinho">
          <div className="mascot-popup-head">
            <img src={guardeiMascot} alt="Mascote do Guardei" />
            <div>
              <strong>Guardinho</strong>
              <small>Seu ajudante anti-procrastinação :)</small>
            </div>
            <button className="modal-close mini" type="button" onClick={() => setOpen(false)}>×</button>
          </div>
        <div className="chat-log">
          {messages.map((message, index) => (
            <div key={index} className={`chat-bubble ${message.role}`}>
              {message.text}
            </div>
          ))}
          {loading && <div className="chat-bubble assistant">O Guardinho está pensando um pouco...</div>}
        </div>

        <form className="chat-form" onSubmit={onSubmit}>
          <textarea
            value={input}
            onChange={event => setInput(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                onSubmit(event);
              }
            }}
            placeholder="Ex: estou sem foco, o que eu vejo agora?"
            aria-label="Mensagem para a IA mascote"
          />
          <button className="primary-btn" type="submit" disabled={loading}>{loading ? '...' : 'Enviar'}</button>
        </form>
          <button className="secondary-btn mascot-random" type="button" onClick={() => randomVideo()}>Escolher algo para mim</button>
        </section>
      )}
      <button className="mascot-launcher" onClick={() => setOpen(value => !value)} aria-label="Abrir chat com o Guardinho">
        <img src={guardeiMascot} alt="" />
      </button>
    </div>
  );
}

function SettingsView({ settings, updateSettings, exportJson, importJson, videos, user, logout }) {
  return (
    <section className="view-stack">
      <Panel title="Conta">
        <div className="account-card">
          <span className="account-avatar"><IconSymbol name="user" /></span>
          <div>
            <strong>{user?.name || 'Usuário Guardei'}</strong>
            <small>{user?.email || 'Modo local sem email conectado'}</small>
          </div>
          {user && <button className="secondary-btn danger fixed-action-btn" onClick={logout}><IconSymbol name="logout" /> Sair</button>}
        </div>
      </Panel>

      <Panel title="Preferências de Revisão">
        <div className="settings-grid">
          <label className="setting-item">
            <span><IconSymbol name="target" /> Meta diária de revisão</span>
            <input
              type="number"
              min="1"
              max="10"
              placeholder="3"
              value={settings.dailyReviewTarget || 3}
              onChange={event => updateSettings({ dailyReviewTarget: Number(event.target.value) })}
            />
          </label>
          <label className="toggle-item">
            <input
              type="checkbox"
              checked={Boolean(settings.autoOpenReviewAfterShare)}
              onChange={event => updateSettings({ autoOpenReviewAfterShare: event.target.checked })}
            />
            <span><IconSymbol name="repeat" /> Abrir revisão após compartilhar</span>
          </label>
        </div>
      </Panel>

      <Panel title="Backup de Dados">
        <div className="backup-actions">
          <button className="primary-btn fixed-action-btn" onClick={exportJson}><IconSymbol name="download" /> Exportar Backup</button>
          <label className="secondary-btn file-btn fixed-action-btn">
            <IconSymbol name="upload" /> Importar Backup
            <input type="file" accept="application/json" onChange={importJson} />
          </label>
          <span className="muted">{videos.length} itens salvos localmente</span>
        </div>
      </Panel>
    </section>
  );
}

function Panel({ title, action, children }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatCard({ icon, label, value, tone = '' }) {
  return (
    <div className={`stat-card ${tone}`}>
      <IconSymbol name={icon} />
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

function CapsulePreviewRow({ video, onClick }) {
  return (
    <button className="capsule-preview-row" onClick={onClick}>
      <span className={`capsule-preview-icon ${video.capsule?.status || ''}`}><IconSymbol name="brain" /></span>
      <span>
        <strong>{getDisplayTitle(video)}</strong>
        <small>{video.capsule?.summary || 'Abra para ver a cápsula.'}</small>
      </span>
      <em>{video.capsule?.status === 'limited' ? 'Limitada' : 'Completa'}</em>
    </button>
  );
}

function CompactVideoRow({ video, onClick }) {
  const category = CATEGORY_BY_ID[video.category] || CATEGORY_BY_ID.misc;
  return (
    <button className="compact-row" onClick={onClick}>
      <span className="compact-icon" style={{ background: category.accent }}>
        <IconSymbol name={category.icon} />
      </span>
      <span>
        <strong>{getDisplayTitle(video)}</strong>
        <small>{category.label} · {getReason(video.reason)} · {timeAgo(video.createdAt)}</small>
      </span>
    </button>
  );
}

function VideoCard({ video, onClick, onDelete, big = false }) {
  const category = CATEGORY_BY_ID[video.category] || CATEGORY_BY_ID.misc;
  const platform = getPlatformMeta(video.platform);
  return (
    <article
      className={`video-card ${big ? 'big' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`Abrir detalhes de ${getDisplayTitle(video)}`}
      onClick={onClick}
      onKeyDown={event => {
        if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        onClick();
      }}
    >
      <div className="thumb" style={{ background: video.thumbnailUrl ? '#111' : category.accent }}>
        {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" loading="lazy" /> : <IconSymbol name={category.icon} />}
        <div className="thumb-overlay" />
        <span className="cat-badge"><IconSymbol name={category.icon} /> {category.label}</span>
        <span className={`priority ${video.priority}`}>{video.priority}</span>
        <span className="platform-badge"><PlatformLogo platform={platform.id} compact /> {platform.label}</span>
        {video.capsule && <span className={`capsule-card-badge ${video.capsule.status}`}><IconSymbol name="brain" /> Cápsula</span>}
        {onDelete && <button type="button" className="delete-btn" aria-label={`Excluir ${getDisplayTitle(video)}`} onClick={event => { event.stopPropagation(); onDelete(); }}>×</button>}
      </div>
      <div className="video-body">
        <h3>{getDisplayTitle(video)}</h3>
        <p>{video.note || video.ai?.rationale || 'Sem nota ainda.'}</p>
        <div className="insight-row">
          <span>{durationLabel(video.durationBucket)}</span>
          <span>{moodLabel(video.mood)}</span>
          <span>{effortLabel(video.effort)}</span>
        </div>
        <div className="tag-row">
          {(video.tags || []).slice(0, big ? 8 : 4).map(tag => <span key={tag}>#{tag}</span>)}
        </div>
        <div className="video-meta">
          <span>{STATUS[video.status]?.label}</span>
          <span>{timeAgo(video.createdAt)}</span>
        </div>
      </div>
    </article>
  );
}

function VideoModal({ video, onClose, onUpdate, onDelete, onOpen, onMarkConsumed, reflectionExpanded, paths, onKnowledgeChanged, onCapsuleChange, onNotify, onOpenRelated }) {
  const [draft, setDraft] = useState(video);
  const [tagText, setTagText] = useState((video.tags || []).join(', '));
  const [watchedMinutes, setWatchedMinutes] = useState(Math.round((video.watchedSeconds || 0) / 60) || 5);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const restoreFocusRef = useRef(null);
  const category = CATEGORY_BY_ID[draft.category] || CATEGORY_BY_ID.misc;
  const platform = getPlatformMeta(draft.platform);

  useEffect(() => {
    setDraft(video);
    setTagText((video.tags || []).join(', '));
    setWatchedMinutes(Math.round((video.watchedSeconds || 0) / 60) || 5);
  }, [video.id]);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, []);

  function patch(value) {
    setDraft(current => ({ ...current, ...value }));
  }

  function saveChanges() {
    onUpdate({
      titleCustom: draft.titleCustom || '',
      note: draft.note || '',
      category: draft.category,
      reason: draft.reason,
      status: draft.status,
      priority: draft.priority,
      mood: draft.mood,
      effort: draft.effort,
      durationBucket: draft.durationBucket,
      bestFor: draft.bestFor || '',
      watchWhen: draft.watchWhen || '',
      sourceName: draft.sourceName || '',
      watchedSeconds: Math.max(0, Number(watchedMinutes || 0) * 60),
      tags: normalizeTagInput(tagText)
    });
    onClose();
  }

  return (
    <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <div className="modal-card" ref={dialogRef} role="dialog" aria-modal="true" aria-label="Detalhes do item salvo">
        <button className="modal-close" ref={closeButtonRef} onClick={onClose} aria-label="Fechar detalhes">×</button>
        <div className="modal-hero" style={{ background: draft.thumbnailUrl ? '#111' : category.accent }}>
          {draft.thumbnailUrl ? <img src={draft.thumbnailUrl} alt="" /> : <IconSymbol name={category.icon} size="large" />}
        </div>
        <div className="modal-content">
          <div className="modal-meta-line">
            <span><PlatformLogo platform={platform.id} compact /> {platform.label} · {category.label}</span>
            <span>{formatAiEngine(draft.ai?.engine)}</span>
          </div>

          <label className="field-item">
            <span><IconSymbol name="edit" /> Título salvo</span>
          <textarea
            className="modal-title-input"
            value={draft.titleCustom || draft.titleAi || ''}
            onChange={event => patch({ titleCustom: event.target.value })}
            placeholder="Ex: Ideia para aplicar no meu projeto"
          />
          </label>

          <label className="field-item">
            <span><IconSymbol name="bookmark" /> Suas notas</span>
          <textarea
            className="modal-note-input"
            value={draft.note || ''}
            onChange={event => patch({ note: event.target.value })}
            placeholder="Ex: por que salvei, contexto, trecho importante..."
          />
          </label>

          <div className="modal-selects">
            <div className="select-caption">
              <span><IconSymbol name="palette" /> Categoria</span>
              <span><IconSymbol name="flag" /> Motivo</span>
              <span><IconSymbol name="check" /> Status</span>
              <span><IconSymbol name="star" /> Prioridade</span>
              <span><IconSymbol name="clock" /> Tempo</span>
              <span><IconSymbol name="smile" /> Mood</span>
            </div>
            <select aria-label="Categoria do item" title="Categoria" value={draft.category} onChange={event => patch({ category: event.target.value })}>
              {CATEGORIES.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}
            </select>
            <select aria-label="Motivo para guardar" title="Motivo" value={draft.reason} onChange={event => patch({ reason: event.target.value })}>
              {REASONS.map(reason => <option key={reason.id} value={reason.id}>{reason.label}</option>)}
            </select>
            <select aria-label="Status de organização do item" title="Status de organização" value={draft.status} onChange={event => patch({ status: event.target.value })}>
              {draft.status === 'aplicado' && <option value="aplicado" disabled>{draft.applicationStatus === 'completed' ? 'Aplicado com evidência' : 'Aplicado (histórico)'}</option>}
              {Object.entries(STATUS).filter(([id]) => id !== 'aplicado').map(([id, status]) => <option key={id} value={id}>{status.label}</option>)}
            </select>
            <select aria-label="Prioridade do item" title="Prioridade" value={draft.priority || 'baixa'} onChange={event => patch({ priority: event.target.value })}>
              <option value="baixa">Prioridade baixa</option>
              <option value="media">Prioridade média</option>
              <option value="alta">Prioridade alta</option>
            </select>
            <select aria-label="Tempo estimado" title="Tempo estimado" value={draft.durationBucket || 'unknown'} onChange={event => patch({ durationBucket: event.target.value })}>
              <option value="short">2 a 5 minutos</option>
              <option value="medium">10 a 20 minutos</option>
              <option value="long">Com calma</option>
              <option value="unknown">Tempo incerto</option>
            </select>
            <select aria-label="Mood do conteúdo" title="Mood" value={draft.mood || 'neutro'} onChange={event => patch({ mood: event.target.value })}>
              <option value="leve">Leve</option>
              <option value="neutro">Neutro</option>
              <option value="focado">Foco</option>
              <option value="criativo">Criativo</option>
            </select>
          </div>

          <label className="field-item">
            <span><IconSymbol name="tag" /> Tags</span>
          <input
            className="modal-tags-input"
            value={tagText}
            onChange={event => setTagText(event.target.value)}
            placeholder="Ex: react, tutorial, inspiração"
          />
          </label>

          <div className="modal-two-fields">
            <input
              value={draft.bestFor || ''}
              onChange={event => patch({ bestFor: event.target.value })}
              aria-label="Ideal para"
              placeholder="Ideal para..."
            />
            <input
              value={draft.watchWhen || ''}
              onChange={event => patch({ watchWhen: event.target.value })}
              aria-label="Assistir quando"
              placeholder="Assistir quando..."
            />
            <input
              value={draft.sourceName || ''}
              onChange={event => patch({ sourceName: event.target.value })}
              aria-label="Fonte do conteúdo"
              placeholder="Fonte do anexo (canal, perfil, curso...)"
            />
            <input
              type="number"
              min="0"
              value={watchedMinutes}
              onChange={event => setWatchedMinutes(event.target.value)}
              aria-label="Tempo consumido em minutos"
              placeholder="Tempo consumido em minutos"
            />
          </div>

          <div className="ai-insights">
            <span>{durationLabel(draft.durationBucket)}</span>
            <span>{moodLabel(draft.mood)}</span>
            <span>{effortLabel(draft.effort)}</span>
            {draft.bestFor && <strong>{draft.bestFor}</strong>}
            {draft.watchWhen && <small>{draft.watchWhen}</small>}
          </div>

          <CapsulePanel
            videoId={video.id}
            initialCapsule={video.capsule}
            onCapsuleChange={onCapsuleChange}
            onNotify={onNotify}
          />

          <ReflectionForm
            video={video}
            expanded={reflectionExpanded}
            onSkip={() => onNotify?.('Você pode registrar o aprendizado depois')}
            onChanged={onKnowledgeChanged}
            onNotify={onNotify}
          />

          <KnowledgeCardPanel videoId={video.id} onChanged={onKnowledgeChanged} onNotify={onNotify} />
          <ApplicationList video={video} paths={paths} onChanged={onKnowledgeChanged} onNotify={onNotify} />
          <RelatedItems videoId={video.id} onOpenItem={onOpenRelated} />

          <div className="modal-actions">
            <button className="primary-btn" onClick={onOpen}>Abrir Link</button>
            <button className="secondary-btn" onClick={() => onMarkConsumed(video.id, watchedMinutes)}>{video.consumedAt || video.watchedAt ? 'Registrar novo consumo' : 'Marcar consumido'}</button>
            <button className="secondary-btn" onClick={saveChanges}>Salvar Alterações</button>
            <button className="secondary-btn danger" onClick={onDelete}>Excluir</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterChip({ active, children, ...props }) {
  return <button className={`filter-chip ${active ? 'active' : ''}`} {...props}>{children}</button>;
}

function PlatformLogo({ platform, compact = false }) {
  const meta = getPlatformMeta(platform);
  return (
    <span
      className={`app-logo ${compact ? 'compact' : ''} ${meta.icon ? '' : 'no-icon'}`}
      style={{ '--brand-color': meta.color, '--brand-accent': meta.accent }}
      aria-hidden="true"
    >
      {meta.icon && (
        <img
          src={`https://cdn.simpleicons.org/${meta.icon}/ffffff`}
          alt=""
          loading="lazy"
          onError={event => {
            event.currentTarget.style.display = 'none';
            if (event.currentTarget.nextElementSibling) event.currentTarget.nextElementSibling.style.display = 'block';
          }}
        />
      )}
      <b>{meta.short}</b>
    </span>
  );
}

function FlowStep({ icon, title }) {
  return (
    <div className="flow-step">
      <IconSymbol name={icon} />
      <strong>{title}</strong>
    </div>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="empty-state">
      <IconSymbol name="inbox" size="large" />
      <strong>{title}</strong>
      <small>{text}</small>
    </div>
  );
}

function MobileDock({ view, setView }) {
  const items = [
    ['home', 'Home', 'home'],
    ['add', 'Salvar', 'plus'],
    ['review', 'Rever', 'repeat'],
    ['library', 'Acervo', 'book'],
    ['paths', 'Trilhas', 'route'],
    ['map', 'Mapa', 'map'],
    ['dashboard', 'Dados', 'chart'],
    ['achievements', 'Troféus', 'trophy'],
    ['settings', 'Config', 'settings']
  ];

  return (
    <nav className="mobile-dock">
      {items.map(([id, label, icon]) => (
        <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>
          <IconSymbol name={icon} />
          <small>{label}</small>
        </button>
      ))}
    </nav>
  );
}

function buildWatchStats(videos) {
  const watchedVideos = videos.filter(video => video.consumedAt || video.watchedAt);
  const byCategory = new Map();
  watchedVideos.forEach(video => {
    const key = video.category || 'misc';
    byCategory.set(key, (byCategory.get(key) || 0) + 1);
  });
  const minutes = watchedVideos.reduce((total, video) => total + Number(video.watchedSeconds || 0) / 60, 0);
  return {
    total: videos.length,
    inbox: videos.filter(video => video.status === 'inbox').length,
    important: videos.filter(video => video.status === 'importante').length,
    archived: videos.filter(video => video.status === 'arquivado').length,
    active: videos.filter(video => video.status !== 'arquivado').length,
    watched: watchedVideos.length,
    minutes,
    watchedCategories: byCategory.size,
    shortWatched: watchedVideos.filter(video => video.durationBucket === 'short').length,
    focusWatched: watchedVideos.filter(video => video.mood === 'focado').length,
    creativeWatched: watchedVideos.filter(video => video.mood === 'criativo').length,
    byCategory
  };
}

async function chatWithMascot({ message, messages, videos, stats }) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_VAULT_API_URL || window.VAULT_API_URL || '';
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/ai/mascot-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      message,
      messages: messages.slice(-8),
      stats: {
        total: stats.total,
        watched: stats.watched,
        minutes: Math.round(stats.minutes),
        inbox: stats.inbox,
        important: stats.important,
        active: stats.active
      }
    })
  });
  if (!response.ok) throw new Error('Falha no chat');
  const data = await response.json();
  return data.answer || buildMascotAnswer(message, videos, stats);
}

function buildMascotAnswer(text, videos, stats) {
  const normalized = text.toLowerCase();
  const pool = buildRecommendationPool(videos, {
    time: normalized.includes('rápido') || normalized.includes('rapido') || normalized.includes('sem foco') ? 'short' : 'any',
    mood: normalized.includes('criativ') ? 'criativo' : normalized.includes('foco') ? 'focado' : normalized.includes('leve') || normalized.includes('cans') ? 'leve' : 'any',
    platform: 'all'
  });
  const next = pool[0]?.video;
  if (normalized.includes('relat') || normalized.includes('consum')) {
    const top = [...stats.byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
    const label = top ? (CATEGORY_BY_ID[top[0]]?.label || 'Geral') : 'nenhuma categoria ainda';
    return `Seu relatório: ${stats.watched} conteúdos consumidos, ${Math.round(stats.minutes)} minutos registrados e maior consumo em ${label}. Próximo passo: escolha um item curto e marque como consumido hoje.`;
  }
  if (normalized.includes('procrast') || normalized.includes('sem foco') || normalized.includes('cans')) {
    return next ? `Modo anti-procrastinação: abre "${getDisplayTitle(next)}" e assiste só 5 minutos. Se não valer, arquiva sem culpa.` : 'Sua fila ainda está vazia. Salve um conteúdo curto e volte aqui para eu te puxar para a revisão.';
  }
  if (next) return `Minha recomendação agora é "${getDisplayTitle(next)}". Ele combina com sua fila e pode destravar a próxima revisão. Depois marque como consumido para alimentar seu dashboard.`;
  return 'Me conte seu mood, tempo livre ou tema desejado. Eu vou usar seu acervo para sugerir algo prático.';
}

function progressHint(achievement, stats) {
  if (achievement.id.includes('save')) return `${stats.total} salvos`;
  if (achievement.id.includes('watch')) return `${stats.watched} consumidos`;
  if (achievement.id.includes('hour')) return `${Math.round(stats.minutes)}min registrados`;
  if (achievement.id.includes('categories')) return `${stats.watchedCategories} categorias`;
  if (achievement.id === 'inbox-zero') return `${stats.inbox} no inbox`;
  if (achievement.id.includes('archive')) return `${stats.archived} arquivados`;
  if (achievement.id.includes('active')) return `${stats.active} ativos`;
  if (achievement.id.includes('short')) return `${stats.shortWatched} curtos consumidos`;
  if (achievement.id.includes('focus')) return `${stats.focusWatched} focados consumidos`;
  if (achievement.id.includes('creative')) return `${stats.creativeWatched} criativos consumidos`;
  if (achievement.id === 'first-reflection') return `${stats.reflectionCount || 0} reflexões`;
  if (achievement.id === 'first-active-review') return `${stats.reviewAttemptCount || 0} revisões ativas`;
  if (achievement.id === 'remembered-5') return `${stats.rememberedCount || 0} lembrados`;
  if (achievement.id === 'first-real-application') return `${stats.applicationsCompleted || 0} aplicações`;
  if (achievement.id === 'review-week') return `${stats.reviewStreakDays || 0} dias seguidos`;
  if (achievement.id === 'applied-3') return `${stats.contentsApplied || 0} aplicados`;
  if (achievement.id === 'recovered-card') return `${stats.recoveredCount || 0} recuperados`;
  if (achievement.id === 'path-with-application') return `${stats.completedPathsWithApplications || 0} trilhas`;
  return 'Em progresso';
}

function getDisplayTitle(video) {
  return video.titleCustom || video.titleAi || video.titleOriginal || 'Item salvo para revisar';
}

function formatAiEngine(engine = '') {
  if (!engine) return 'Organização automática';
  if (engine.startsWith('gemini:')) return `Gemini (${engine.replace('gemini:', '')})`;
  if (engine === 'gemini') return 'Gemini';
  if (engine === 'server-heuristic') return 'Análise local';
  if (engine === 'local-heuristic' || engine === 'browser-heuristic') return 'Análise no navegador';
  return engine;
}

function normalizeTagInput(value = '') {
  return String(value)
    .split(',')
    .map(tag => tag.trim().replace(/^#/, '').toLowerCase())
    .filter(Boolean)
    .slice(0, 12);
}

function getReason(reasonId) {
  return REASONS.find(reason => reason.id === reasonId)?.label || 'Guardar';
}

function scoreForReview(video) {
  const priority = { alta: 40, media: 25, baixa: 10 }[video.priority] || 0;
  const status = { importante: 30, inbox: 20, novo: 15, rever: 10 }[video.status] || 0;
  const created = new Date(video.createdAt || Date.now()).getTime();
  const reviewed = video.reviewedAt ? new Date(video.reviewedAt).getTime() : created - 1000 * 60 * 60 * 24 * 30;
  const daysSinceReview = Math.max(1, (Date.now() - reviewed) / 86400000);
  return priority + status + daysSinceReview;
}

function buildRecommendationPool(videos, preferences = DEFAULT_RECOMMENDATION) {
  return videos
    .filter(video => video.status !== 'arquivado')
    .filter(video => preferences.platform === 'all' || (video.platform || 'tiktok') === preferences.platform)
    .map(video => {
      let score = scoreForReview(video);
      if (preferences.time !== 'any' && (video.durationBucket || 'unknown') === preferences.time) score += 26;
      if (preferences.time === 'short' && (video.effort === 'baixo' || video.mood === 'leve')) score += 10;
      if (preferences.mood !== 'any' && video.mood === preferences.mood) score += 22;
      if (preferences.mood === 'leve' && video.effort === 'baixo') score += 14;
      if (video.status === 'inbox') score -= 8;
      if (video.priority === 'alta') score += 8;
      return { video, score };
    })
    .sort((a, b) => b.score - a.score);
}

function durationLabel(value) {
  return {
    short: '2-5 min',
    medium: '10-20 min',
    long: 'Com calma',
    unknown: 'Tempo incerto'
  }[value] || 'Tempo incerto';
}

function moodLabel(value) {
  return {
    leve: 'Leve',
    neutro: 'Neutro',
    focado: 'Focado',
    criativo: 'Criativo'
  }[value] || 'Neutro';
}

function effortLabel(value) {
  return {
    baixo: 'Esforço baixo',
    medio: 'Esforço médio',
    alto: 'Esforço alto'
  }[value] || 'Esforço médio';
}

function timeAgo(value) {
  if (!value) return 'sem data';
  const diff = Date.now() - new Date(value).getTime();
  if (diff < 60_000) return 'agora';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d`;
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
