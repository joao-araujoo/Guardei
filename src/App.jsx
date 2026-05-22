import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, CATEGORY_BY_ID, REASONS, STATUS } from './lib/categories.js';
import { buildAutoVideo } from './lib/aiClassifier.js';
import { PLATFORM_OPTIONS, getPlatformMeta } from './lib/platforms.js';
import { createRepository, exportVault, importVaultPayload } from './lib/storage.js';
import { extractSupportedVideoUrl, getSharePayloadFromUrl } from './lib/tiktok.js';

const repository = createRepository();
const DEFAULT_FILTERS = { query: '', category: 'all', status: 'active', platform: 'all' };
const DEFAULT_RECOMMENDATION = { time: 'any', mood: 'any', platform: 'all' };

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
  const [isInstallable, setIsInstallable] = useState(false);
  const deferredPromptRef = useRef(null);

  const selectedVideo = useMemo(() => videos.find(video => video.id === selectedId) || null, [videos, selectedId]);

  const activeVideos = useMemo(() => videos.filter(video => video.status !== 'arquivado'), [videos]);
  const inboxVideos = useMemo(() => videos.filter(video => video.status === 'inbox'), [videos]);
  const importantVideos = useMemo(() => videos.filter(video => video.status === 'importante'), [videos]);
  const appliedVideos = useMemo(() => videos.filter(video => video.status === 'aplicado'), [videos]);

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
      if (!query) return true;
      const haystack = [video.titleCustom, video.titleAi, video.titleOriginal, video.authorName, video.category, video.reason, video.note, video.summary, video.bestFor, video.watchWhen, video.mood, video.effort, video.platform, ...(video.tags || [])].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [filters, videos]);

  useEffect(() => {
    async function boot() {
      let initialVideos = [];
      let initialSettings = {};
      try {
        if (repository.me) {
          const session = await repository.me();
          setUser(session.user);
        }
        [initialVideos, initialSettings] = await Promise.all([repository.listVideos(), repository.getSettings?.() || {}]);
      } catch (error) {
        if (error.status === 401) {
          setAuthChecked(true);
          return;
        }
        showToast('API indisponivel. Confira o backend e o banco.');
        setAuthChecked(true);
        return;
      }
      setVideos(initialVideos);
      setSettings(initialSettings);

      const params = new URLSearchParams(window.location.search);
      if (params.has('review')) setView('review');
      if (params.has('add')) setView('add');

      const payload = getSharePayloadFromUrl();
      if (payload.isShareTarget && payload.url) {
        await saveAuto({ url: payload.url, text: payload.sourceText, title: payload.title, origin: 'share-target', silent: true });
        await loadVaultData();
        window.history.replaceState({}, document.title, '/');
        showToast('Link salvo no acervo');
        if (initialSettings?.autoOpenReviewAfterShare) setView('review');
      }
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

  function showToast(message) {
    setToast(message);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(''), 2400);
  }

  async function loadVaultData() {
    const [nextVideos, nextSettings] = await Promise.all([repository.listVideos(), repository.getSettings?.() || {}]);
    setVideos(nextVideos);
    setSettings(nextSettings);
  }

  async function handleAuth(event) {
    event?.preventDefault();
    setAuthLoading(true);
    try {
      const action = authMode === 'register' ? repository.register : repository.login;
      const result = await action.call(repository, authForm);
      setUser(result.user);
      await loadVaultData();
      showToast(authMode === 'register' ? 'Conta criada com seguranca' : 'Login realizado');
    } catch (error) {
      showToast(error.payload?.message || 'Nao consegui autenticar');
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
    setView('home');
    showToast('Sessao encerrada');
  }

  async function syncVideos(nextVideos) {
    setVideos(nextVideos);
    await repository.saveVideos?.(nextVideos);
  }

  async function saveAuto({ url, text = '', title = '', origin = 'manual', silent = false }) {
    const finalUrl = extractSupportedVideoUrl(url || text || title);
    if (!finalUrl) {
      if (!silent) showToast('Cole um link valido da internet');
      return null;
    }

    const alreadyExists = videos.find(video => video.url === finalUrl || video.canonicalUrl === finalUrl);
    if (alreadyExists) {
      if (!silent) {
        setSelectedId(alreadyExists.id);
        showToast('Esse vídeo já estava salvo');
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
      if (!silent) showToast(video.status === 'inbox' ? 'Salvo no Inbox' : 'Salvo e organizado com IA');
      return result?.video || video;
    } catch (error) {
      showToast('Não consegui salvar agora');
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
      showToast('Clipboard sem link valido');
        return;
      }
      await saveAuto({ url, text, origin: 'clipboard' });
    } catch {
      showToast('Não consegui acessar o clipboard');
    }
  }

  async function updateVideo(id, patch) {
    const updated = await repository.updateVideo(id, patch);
    const next = videos.map(video => video.id === id ? { ...video, ...patch, updatedAt: new Date().toISOString() } : video);
    setVideos(next);
    return updated;
  }

  async function deleteVideo(id) {
    await repository.deleteVideo(id);
    setVideos(videos.filter(video => video.id !== id));
    if (selectedId === id) setSelectedId(null);
    showToast('Removido do acervo');
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

  function openVideo(video) {
    if (!video?.url) return;
    window.open(video.url, '_blank', 'noopener,noreferrer');
  }

  function randomVideo(preferences = recommendation) {
    const pool = buildRecommendationPool(activeVideos.length ? activeVideos : videos, preferences);
    if (!pool.length) {
      showToast('Nada combina com esse filtro');
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
    showToast('Backup exportado');
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
      showToast('Backup importado');
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
        <button className="brand" onClick={() => setView('home')} aria-label="Ir para a home">
          <span className="brand-mark">V</span>
          <span>
            <strong>GUARDEI</strong>
            <small>/ acervo esperto</small>
          </span>
        </button>

        <nav className="desktop-nav">
          <NavButton active={view === 'home'} onClick={() => setView('home')}>Hoje</NavButton>
          <NavButton active={view === 'review'} onClick={() => setView('review')}>Revisar</NavButton>
          <NavButton active={view === 'library'} onClick={() => setView('library')}>Biblioteca</NavButton>
          <NavButton active={view === 'settings'} onClick={() => setView('settings')}>Setup</NavButton>
        </nav>

        <div className="top-actions">
          {user && <span className="user-pill">{user.name || user.email}</span>}
          <span className="count-pill">{videos.length} itens</span>
          {user && <button className="ghost-btn" onClick={logout}>sair</button>}
          <button className="ghost-btn" onClick={() => setView('add')}>+ salvar</button>
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
            openVideo={openVideo}
            setSelectedId={setSelectedId}
            randomVideo={randomVideo}
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
          />
        )}

        {view === 'settings' && (
          <SettingsView
            settings={settings || {}}
            updateSettings={updateSettings}
            exportJson={exportJson}
            importJson={importJson}
            videos={videos}
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
        />
      )}

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
        <span className="eyebrow">acesso seguro</span>
        <h1>{isRegister ? 'Crie sua conta.' : 'Entre no seu acervo.'}</h1>
        <p>Cada conta acessa somente os proprios links, notas, tags e preferencias.</p>

        <form className="auth-form" onSubmit={onSubmit}>
          {isRegister && (
            <input
              value={form.name}
              onChange={event => setForm({ ...form, name: event.target.value })}
              placeholder="Nome"
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
            {loading ? 'Validando...' : isRegister ? 'Criar conta' : 'Entrar'}
          </button>
        </form>

        <button className="auth-switch" type="button" onClick={() => setMode(isRegister ? 'login' : 'register')}>
          {isRegister ? 'Ja tenho conta' : 'Criar nova conta'}
        </button>
      </div>
    </section>
  );
}

function HomeView({ videos, dailyQueue, inboxVideos, importantVideos, appliedVideos, setView, setSelectedId, randomVideo, recommendation, setRecommendation, isInstallable, installApp, pasteFromClipboard }) {
  return (
    <section className="view-stack">
      <div className="hero-panel">
        <div>
          <span className="eyebrow">acervo controlado</span>
          <h1>Guarde qualquer coisa boa da internet.</h1>
          <p>Links, videos, threads, musicas, artigos e ideias entram no mesmo acervo. A IA ajuda a organizar e escolhe o que combina com seu tempo livre.</p>
        </div>
        <div className="hero-actions">
          <button className="primary-btn" onClick={() => setView('add')}>Salvar link</button>
          <button className="secondary-btn" onClick={pasteFromClipboard}>Colar automático</button>
          {isInstallable && <button className="secondary-btn" onClick={installApp}>Instalar PWA</button>}
        </div>
      </div>

      <div className="stats-grid">
        <StatCard label="No acervo" value={videos.length} emoji="📚" />
        <StatCard label="Inbox" value={inboxVideos.length} emoji="📥" tone={inboxVideos.length ? 'warn' : ''} />
        <StatCard label="Importantes" value={importantVideos.length} emoji="⭐" />
        <StatCard label="Aplicados" value={appliedVideos.length} emoji="✅" />
      </div>

      <div className="split-layout">
        <Panel title="Pra ver hoje" action={<button onClick={() => setView('review')}>revisar</button>}>
          {dailyQueue.length ? (
            <div className="daily-list">
              {dailyQueue.map(video => <CompactVideoRow key={video.id} video={video} onClick={() => setSelectedId(video.id)} />)}
            </div>
          ) : <EmptyState title="Nada pendente" text="Salve qualquer link para comecar." />}
        </Panel>

        <Panel title="Nao quero escolher" action={<button onClick={() => randomVideo(recommendation)}>sortear</button>}>
          <div className="smart-picker">
            <select value={recommendation.time} onChange={event => setRecommendation({ ...recommendation, time: event.target.value })}>
              <option value="any">Qualquer tempo</option>
              <option value="short">2 a 5 min</option>
              <option value="medium">10 a 20 min</option>
              <option value="long">Com calma</option>
            </select>
            <select value={recommendation.mood} onChange={event => setRecommendation({ ...recommendation, mood: event.target.value })}>
              <option value="any">Qualquer humor</option>
              <option value="leve">Agua com acucar</option>
              <option value="focado">Foco</option>
              <option value="criativo">Criativo</option>
            </select>
            <select value={recommendation.platform} onChange={event => setRecommendation({ ...recommendation, platform: event.target.value })}>
              <option value="all">Todas as fontes</option>
              {PLATFORM_OPTIONS.map(platform => <option key={platform.id} value={platform.id}>{platform.label}</option>)}
            </select>
          </div>
          <div className="roulette-card" onClick={() => randomVideo(recommendation)} role="button" tabIndex={0}>
            <span>🎲</span>
            <strong>Escolha por mim</strong>
            <small>a IA cruza tempo livre, humor e energia mental</small>
          </div>
        </Panel>
      </div>

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
          <span>{category.emoji}</span>
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
        <span className="eyebrow">joga aqui</span>
        <h2>Cole qualquer link que voce nao quer perder.</h2>
        <p>Musica, video, post, artigo, repositorio, curso, produto ou ideia. A IA cria titulo, nota, tags, prioridade, humor e melhor momento para abrir.</p>

        <form onSubmit={handleSubmit} className="smart-form">
          <input
            value={input}
            onChange={event => setInput(event.target.value)}
            placeholder="https://open.spotify.com/... ou https://x.com/... ou qualquer link"
            autoFocus
          />
          <input
            value={manualTitle}
            onChange={event => setManualTitle(event.target.value)}
            placeholder="Titulo opcional para esse item"
          />
          <textarea
            value={sourceText}
            onChange={event => setSourceText(event.target.value)}
            placeholder="Opcional: cole legenda, comentario ou por que voce guardou. Isso ajuda a IA a recomendar melhor depois."
          />
          <div className="form-actions">
            <button type="submit" className="primary-btn" disabled={isSaving}>{isSaving ? 'Organizando...' : 'Guardar no acervo'}</button>
            <button type="button" className="secondary-btn" onClick={pasteFromClipboard}>Ler clipboard</button>
          </div>
        </form>
      </div>

      <div className="flow-preview">
        <FlowStep emoji="🔗" title="Link" />
        <FlowStep emoji="🤖" title="IA" />
        <FlowStep emoji="🏷️" title="Contexto" />
        <FlowStep emoji="📥" title="Acervo" />
      </div>
    </section>
  );
}

function ReviewView({ video, queueLength, reviewIndex, setReviewIndex, markReview, openVideo, setSelectedId, randomVideo }) {
  if (!video) {
    return (
      <section className="center-view">
        <EmptyState title="Fila limpa" text="Nenhum item pendente para revisar agora." />
        <button className="primary-btn" onClick={randomVideo}>Sortear qualquer item</button>
      </section>
    );
  }

  return (
    <section className="review-view">
      <div className="review-top">
        <span className="eyebrow">revisão rápida</span>
        <strong>{Math.min(reviewIndex + 1, queueLength)} / {queueLength}</strong>
      </div>

      <VideoCard video={video} big onClick={() => setSelectedId(video.id)} />

      <div className="review-actions">
        <button onClick={() => markReview(video.id, 'arquivado')}>🗄️ Arquivar</button>
        <button onClick={() => markReview(video.id, 'rever')}>🔁 Depois</button>
        <button className="open" onClick={() => openVideo(video)}>▶ Abrir</button>
        <button onClick={() => markReview(video.id, 'importante')}>⭐ Importante</button>
        <button onClick={() => markReview(video.id, 'aplicado')}>✅ Usei</button>
      </div>

      <div className="review-nav">
        <button onClick={() => setReviewIndex(Math.max(reviewIndex - 1, 0))}>← anterior</button>
        <button onClick={() => setReviewIndex(Math.min(reviewIndex + 1, queueLength - 1))}>próximo →</button>
      </div>
    </section>
  );
}

function LibraryView({ videos, total, filters, setFilters, setSelectedId, deleteVideo }) {
  return (
    <section className="view-stack">
      <div className="library-head">
        <div>
          <span className="eyebrow">biblioteca</span>
          <h2>{videos.length} de {total} itens</h2>
        </div>
        <input
          className="search-input"
          value={filters.query}
          onChange={event => setFilters({ ...filters, query: event.target.value })}
          placeholder="buscar por titulo, tag, nota..."
        />
      </div>

      <div className="filter-strip">
        <FilterChip active={filters.category === 'all'} onClick={() => setFilters({ ...filters, category: 'all' })}>Todos</FilterChip>
        {CATEGORIES.map(category => (
          <FilterChip key={category.id} active={filters.category === category.id} onClick={() => setFilters({ ...filters, category: category.id })}>{category.emoji} {category.label}</FilterChip>
        ))}
      </div>

      <div className="filter-strip compact">
        <FilterChip active={filters.status === 'active'} onClick={() => setFilters({ ...filters, status: 'active' })}>Ativos</FilterChip>
        <FilterChip active={filters.status === 'all'} onClick={() => setFilters({ ...filters, status: 'all' })}>Todos</FilterChip>
        {Object.entries(STATUS).map(([id, status]) => (
          <FilterChip key={id} active={filters.status === id} onClick={() => setFilters({ ...filters, status: id })}>{status.emoji} {status.label}</FilterChip>
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

      {videos.length ? (
        <div className="video-grid">
          {videos.map(video => <VideoCard key={video.id} video={video} onClick={() => setSelectedId(video.id)} onDelete={() => deleteVideo(video.id)} />)}
        </div>
      ) : <EmptyState title="Nada encontrado" text="Tente limpar os filtros." />}
    </section>
  );
}

function SettingsView({ settings, updateSettings, exportJson, importJson, videos }) {
  return (
    <section className="view-stack">
      <Panel title="Automação">
        <div className="settings-grid">
          <label className="setting-item">
            <span>Meta diária</span>
            <input
              type="number"
              min="1"
              max="10"
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
            <span>Abrir revisão depois de compartilhar</span>
          </label>
        </div>
      </Panel>

      <Panel title="Banco de dados">
        <div className="db-ready-card">
          <strong>Postgres com login por usuario</strong>
          <p>O frontend usa a API com cookie seguro. Depois de alterar o schema, rode npm run db:generate e npm run db:push dentro da pasta server para criar User, UserSettings e vincular os videos por usuario.</p>
          <div className="schema-pills">
            <span>users</span><span>videos por usuario</span><span>settings</span><span>prisma</span><span>neon</span>
          </div>
        </div>
      </Panel>

      <Panel title="Backup">
        <div className="backup-actions">
          <button className="primary-btn" onClick={exportJson}>Exportar JSON</button>
          <label className="secondary-btn file-btn">
            Importar JSON
            <input type="file" accept="application/json" onChange={importJson} />
          </label>
          <span className="muted">{videos.length} itens no armazenamento atual</span>
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

function StatCard({ emoji, label, value, tone = '' }) {
  return (
    <div className={`stat-card ${tone}`}>
      <span>{emoji}</span>
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

function CompactVideoRow({ video, onClick }) {
  const category = CATEGORY_BY_ID[video.category] || CATEGORY_BY_ID.misc;
  return (
    <button className="compact-row" onClick={onClick}>
      <span className="compact-emoji" style={{ background: category.accent }}>{category.emoji}</span>
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
    <article className={`video-card ${big ? 'big' : ''}`} onClick={onClick}>
      <div className="thumb" style={{ background: video.thumbnailUrl ? '#111' : category.accent }}>
        {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" loading="lazy" /> : <span>{category.emoji}</span>}
        <div className="thumb-overlay" />
        <span className="cat-badge">{category.emoji} {category.label}</span>
        <span className={`priority ${video.priority}`}>{video.priority}</span>
        <span className="platform-badge"><PlatformLogo platform={platform.id} compact /> {platform.label}</span>
        {onDelete && <button className="delete-btn" onClick={event => { event.stopPropagation(); onDelete(); }}>×</button>}
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
          <span>{STATUS[video.status]?.emoji} {STATUS[video.status]?.label}</span>
          <span>{timeAgo(video.createdAt)}</span>
        </div>
      </div>
    </article>
  );
}

function VideoModal({ video, onClose, onUpdate, onDelete, onOpen }) {
  const [draft, setDraft] = useState(video);
  const [tagText, setTagText] = useState((video.tags || []).join(', '));
  const category = CATEGORY_BY_ID[draft.category] || CATEGORY_BY_ID.misc;
  const platform = getPlatformMeta(draft.platform);

  useEffect(() => {
    setDraft(video);
    setTagText((video.tags || []).join(', '));
  }, [video]);

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
      tags: normalizeTagInput(tagText)
    });
    onClose();
  }

  return (
    <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <div className="modal-card">
        <button className="modal-close" onClick={onClose}>×</button>
        <div className="modal-hero" style={{ background: draft.thumbnailUrl ? '#111' : category.accent }}>
          {draft.thumbnailUrl ? <img src={draft.thumbnailUrl} alt="" /> : <span>{category.emoji}</span>}
        </div>
        <div className="modal-content">
          <div className="modal-meta-line">
            <span><PlatformLogo platform={platform.id} compact /> {platform.label} · {category.emoji} {category.label}</span>
            <span>{formatAiEngine(draft.ai?.engine)}</span>
          </div>

          <textarea
            className="modal-title-input"
            value={draft.titleCustom || draft.titleAi || ''}
            onChange={event => patch({ titleCustom: event.target.value })}
            placeholder="Titulo do item"
          />

          <textarea
            className="modal-note-input"
            value={draft.note || ''}
            onChange={event => patch({ note: event.target.value })}
            placeholder="Nota rapida do que vale lembrar"
          />

          <div className="modal-selects">
            <select value={draft.category} onChange={event => patch({ category: event.target.value })}>
              {CATEGORIES.map(category => <option key={category.id} value={category.id}>{category.emoji} {category.label}</option>)}
            </select>
            <select value={draft.reason} onChange={event => patch({ reason: event.target.value })}>
              {REASONS.map(reason => <option key={reason.id} value={reason.id}>{reason.emoji} {reason.label}</option>)}
            </select>
            <select value={draft.status} onChange={event => patch({ status: event.target.value })}>
              {Object.entries(STATUS).map(([id, status]) => <option key={id} value={id}>{status.emoji} {status.label}</option>)}
            </select>
            <select value={draft.priority || 'baixa'} onChange={event => patch({ priority: event.target.value })}>
              <option value="baixa">Prioridade baixa</option>
              <option value="media">Prioridade media</option>
              <option value="alta">Prioridade alta</option>
            </select>
            <select value={draft.durationBucket || 'unknown'} onChange={event => patch({ durationBucket: event.target.value })}>
              <option value="short">2 a 5 min</option>
              <option value="medium">10 a 20 min</option>
              <option value="long">Com calma</option>
              <option value="unknown">Tempo incerto</option>
            </select>
            <select value={draft.mood || 'neutro'} onChange={event => patch({ mood: event.target.value })}>
              <option value="leve">Leve</option>
              <option value="neutro">Neutro</option>
              <option value="focado">Foco</option>
              <option value="criativo">Criativo</option>
            </select>
          </div>

          <input
            className="modal-tags-input"
            value={tagText}
            onChange={event => setTagText(event.target.value)}
            placeholder="tags separadas por virgula"
          />

          <div className="modal-two-fields">
            <input
              value={draft.bestFor || ''}
              onChange={event => patch({ bestFor: event.target.value })}
              placeholder="Melhor para..."
            />
            <input
              value={draft.watchWhen || ''}
              onChange={event => patch({ watchWhen: event.target.value })}
              placeholder="Abrir quando..."
            />
          </div>

          <div className="ai-insights">
            <span>{durationLabel(draft.durationBucket)}</span>
            <span>{moodLabel(draft.mood)}</span>
            <span>{effortLabel(draft.effort)}</span>
            {draft.bestFor && <strong>{draft.bestFor}</strong>}
            {draft.watchWhen && <small>{draft.watchWhen}</small>}
          </div>

          <div className="modal-actions">
            <button className="primary-btn" onClick={onOpen}>Abrir link</button>
            <button className="secondary-btn" onClick={saveChanges}>Salvar edicao</button>
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

function FlowStep({ emoji, title }) {
  return (
    <div className="flow-step">
      <span>{emoji}</span>
      <strong>{title}</strong>
    </div>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="empty-state">
      <span>📼</span>
      <strong>{title}</strong>
      <small>{text}</small>
    </div>
  );
}

function MobileDock({ view, setView }) {
  const items = [
    ['home', 'Hoje', '🏠'],
    ['add', 'Salvar', '➕'],
    ['review', 'Rever', '🔁'],
    ['library', 'Acervo', '📚'],
    ['settings', 'Setup', '⚙️']
  ];

  return (
    <nav className="mobile-dock">
      {items.map(([id, label, emoji]) => (
        <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>
          <span>{emoji}</span>
          <small>{label}</small>
        </button>
      ))}
    </nav>
  );
}

function getDisplayTitle(video) {
  return video.titleCustom || video.titleAi || video.titleOriginal || 'Link salvo para revisar';
}

function formatAiEngine(engine = '') {
  if (!engine) return 'Organizacao automatica';
  if (engine.startsWith('gemini:')) return `IA Gemini (${engine.replace('gemini:', '')})`;
  if (engine === 'gemini') return 'IA Gemini';
  if (engine === 'server-heuristic') return 'Classificacao local';
  if (engine === 'local-heuristic' || engine === 'browser-heuristic') return 'Classificacao do navegador';
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
    long: 'com calma',
    unknown: 'tempo incerto'
  }[value] || 'tempo incerto';
}

function moodLabel(value) {
  return {
    leve: 'leve',
    neutro: 'neutro',
    focado: 'foco',
    criativo: 'criativo'
  }[value] || 'neutro';
}

function effortLabel(value) {
  return {
    baixo: 'baixo esforco',
    medio: 'medio esforco',
    alto: 'alto esforco'
  }[value] || 'medio esforco';
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
