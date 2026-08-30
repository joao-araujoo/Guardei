import { useEffect, useMemo, useRef, useState } from 'react';
import { everywhereService, fileToDataUrl } from '../../services/everywhereService.js';
import './everywhere.css';

const INTENTS = [
  { id: 'ver-depois', label: 'Ver depois', icon: 'lucide:clock-3' },
  { id: 'aplicar', label: 'Usar', icon: 'lucide:hammer' },
  { id: 'aprender', label: 'Aprender', icon: 'lucide:brain' },
  { id: 'inspirar', label: 'Inspirar', icon: 'lucide:sparkles' },
  { id: 'comprar', label: 'Comprar', icon: 'lucide:shopping-bag' }
];

export default function EverywhereLayer() {
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('today');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [url, setUrl] = useState('');
  const [intent, setIntent] = useState('ver-depois');
  const [note, setNote] = useState('');
  const [thought, setThought] = useState('');
  const [digest, setDigest] = useState(null);
  const [spaces, setSpaces] = useState([]);
  const [videos, setVideos] = useState([]);
  const [collections, setCollections] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [settings, setSettings] = useState({});
  const [search, setSearch] = useState('');
  const [synthesis, setSynthesis] = useState(null);
  const [collectionTitle, setCollectionTitle] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [lastToken, setLastToken] = useState('');
  const [intentTarget, setIntentTarget] = useState(null);
  const dirtyRef = useRef(false);
  const noticeTimer = useRef(null);

  useEffect(() => {
    let active = true;
    everywhereService.settings().then(data => {
      if (!active) return;
      setSettings(data || {});
      setAvailable(true);
    }).catch(error => {
      if (active && error?.status !== 401) console.warn('Camada universal indisponível:', error);
    });
    return () => {
      active = false;
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  useEffect(() => {
    const handleKey = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
        setTab('capture');
      }
      if (event.key === 'Escape' && open) closePanel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open]);

  useEffect(() => {
    if (!open || !available) return;
    loadHub();
  }, [open, available]);

  async function loadHub() {
    const results = await Promise.allSettled([
      everywhereService.digest(),
      everywhereService.spaces(),
      everywhereService.videos(),
      everywhereService.collections(),
      everywhereService.captureTokens(),
      everywhereService.settings()
    ]);
    const [digestResult, spacesResult, videosResult, collectionsResult, tokensResult, settingsResult] = results;
    if (digestResult.status === 'fulfilled') setDigest(digestResult.value);
    if (spacesResult.status === 'fulfilled') setSpaces(spacesResult.value?.spaces || []);
    if (videosResult.status === 'fulfilled') {
      const nextVideos = videosResult.value || [];
      setVideos(nextVideos);
      const recentWithoutIntent = nextVideos.find(item => !item.savedFor && Date.now() - new Date(item.createdAt || 0).getTime() < 15 * 60 * 1000);
      if (recentWithoutIntent) setIntentTarget(recentWithoutIntent);
    }
    if (collectionsResult.status === 'fulfilled') setCollections(collectionsResult.value || []);
    if (tokensResult.status === 'fulfilled') setTokens(tokensResult.value || []);
    if (settingsResult.status === 'fulfilled') setSettings(settingsResult.value || {});
  }

  function closePanel() {
    setOpen(false);
    if (dirtyRef.current) {
      dirtyRef.current = false;
      window.dispatchEvent(new CustomEvent('guardei:vault-changed'));
    }
  }

  function flash(message) {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 3200);
  }

  async function captureUrl(event) {
    event?.preventDefault();
    if (!url.trim()) return flash('Cole um link para guardar.');
    setBusy(true);
    try {
      const result = await everywhereService.captureUrl({ url: url.trim(), note, savedFor: intent, origin: 'universal-capture' });
      dirtyRef.current = true;
      setIntentTarget(result.video || null);
      setUrl('');
      setNote('');
      flash(result.duplicated ? 'Isso já estava no seu Guardei.' : 'Guardado. O resto eu organizo.');
      await loadHub();
    } catch (error) {
      flash(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function pasteClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
    } catch {
      flash('O navegador não liberou o clipboard.');
    }
  }

  async function captureScreenshot(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      await everywhereService.captureScreenshot({ dataUrl, savedFor: intent, note });
      dirtyRef.current = true;
      flash('Screenshot guardado e tornado pesquisável.');
      await loadHub();
    } catch (error) {
      flash(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveThought(event) {
    event?.preventDefault();
    if (!thought.trim()) return;
    setBusy(true);
    try {
      await everywhereService.captureThought({ text: thought.trim() });
      setThought('');
      flash('Pensamento guardado.');
    } catch (error) {
      flash(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function applyIntent(value) {
    if (!intentTarget?.id) return;
    try {
      const updated = await everywhereService.updateVideo(intentTarget.id, { savedFor: value, reason: value === 'ver-depois' ? 'guardar' : value });
      setIntentTarget(null);
      setVideos(items => items.map(item => item.id === updated.id ? updated : item));
      dirtyRef.current = true;
      flash('Entendi por que isso importa.');
    } catch (error) {
      flash(error.message);
    }
  }

  async function runSynthesis(event) {
    event?.preventDefault();
    if (!search.trim()) return;
    setBusy(true);
    setSynthesis(null);
    try {
      setSynthesis(await everywhereService.synthesize(search.trim()));
    } catch (error) {
      flash(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const content = await file.text();
      const format = file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'html';
      const result = await everywhereService.importBookmarks({ format, content });
      dirtyRef.current = result.created > 0;
      flash(`${result.created} favoritos importados; ${result.duplicated} já estavam aqui.`);
      await loadHub();
    } catch (error) {
      flash(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function createCollection(event) {
    event?.preventDefault();
    if (!collectionTitle.trim() || !selectedIds.length) return flash('Dê um nome e escolha ao menos um item.');
    setBusy(true);
    try {
      const created = await everywhereService.createCollection({ title: collectionTitle.trim(), videoIds: selectedIds, isPublic: true });
      setCollectionTitle('');
      setSelectedIds([]);
      setCollections(items => [created, ...items]);
      flash('Coleção compartilhável criada.');
    } catch (error) {
      flash(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function createToken() {
    setBusy(true);
    try {
      const result = await everywhereService.createCaptureToken('Extensão do navegador');
      setLastToken(result.token || '');
      await loadHub();
      flash('Token criado. Copie agora: ele só aparece uma vez.');
    } catch (error) {
      flash(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleSetting(key) {
    const next = !settings[key];
    setSettings(current => ({ ...current, [key]: next }));
    try {
      setSettings(await everywhereService.updateSettings({ [key]: next }));
    } catch (error) {
      setSettings(current => ({ ...current, [key]: !next }));
      flash(error.message);
    }
  }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
      flash('Copiado.');
    } catch {
      flash('Não consegui copiar automaticamente.');
    }
  }

  const recentVideos = useMemo(() => videos.slice(0, 18), [videos]);
  if (!available) return null;

  return (
    <div className="everywhere-root">
      <button className="everywhere-launcher" type="button" onClick={() => { setOpen(true); setTab('capture'); }} aria-label="Abrir captura universal do Guardei">
        <iconify-icon icon="lucide:plus" />
        <span><strong>Guardar</strong><small>Ctrl K</small></span>
      </button>

      {intentTarget && !open ? (
        <aside className="intent-toast">
          <div><span>Guardado</span><strong>Por que isso importa?</strong></div>
          <IntentChips value="" onChange={applyIntent} compact />
          <button type="button" className="everywhere-icon" onClick={() => setIntentTarget(null)} aria-label="Ignorar por agora"><iconify-icon icon="lucide:x" /></button>
        </aside>
      ) : null}

      {open ? (
        <div className="everywhere-backdrop" onMouseDown={event => event.target === event.currentTarget && closePanel()}>
          <section className="everywhere-panel" role="dialog" aria-modal="true" aria-labelledby="everywhere-title">
            <header className="everywhere-head">
              <div><span>Guardei em todo lugar</span><h2 id="everywhere-title">Pouco trabalho. Mais memória.</h2></div>
              <button className="everywhere-icon" type="button" onClick={closePanel} aria-label="Fechar"><iconify-icon icon="lucide:x" /></button>
            </header>

            <nav className="everywhere-tabs" aria-label="Atalhos do Guardei">
              <Tab active={tab === 'today'} icon="lucide:sun" onClick={() => setTab('today')}>Agora</Tab>
              <Tab active={tab === 'capture'} icon="lucide:plus-circle" onClick={() => setTab('capture')}>Guardar</Tab>
              <Tab active={tab === 'find'} icon="lucide:search" onClick={() => setTab('find')}>Encontrar</Tab>
              <Tab active={tab === 'more'} icon="lucide:sliders-horizontal" onClick={() => setTab('more')}>Mais</Tab>
            </nav>

            <div className="everywhere-scroll">
              {notice ? <div className="everywhere-notice" role="status">{notice}</div> : null}

              {tab === 'today' ? <TodayTab digest={digest} spaces={spaces} onRefresh={async () => { setBusy(true); try { setDigest(await everywhereService.refreshDigest()); } finally { setBusy(false); } }} busy={busy} /> : null}

              {tab === 'capture' ? (
                <div className="everywhere-stack">
                  <section className="everywhere-card everywhere-card--featured">
                    <div className="everywhere-card-head"><div><span>Um toque</span><h3>Guardar um link</h3></div><iconify-icon icon="lucide:bookmark-plus" /></div>
                    <form onSubmit={captureUrl} className="capture-form">
                      <div className="capture-url-row"><input type="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="Cole qualquer link" aria-label="Link para guardar" /><button type="button" onClick={pasteClipboard}>Colar</button></div>
                      <IntentChips value={intent} onChange={setIntent} />
                      <textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Contexto opcional: por que você guardou isso?" rows="2" />
                      <button className="everywhere-primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar e seguir'}</button>
                    </form>
                  </section>

                  <div className="capture-two-col">
                    <label className="capture-drop">
                      <iconify-icon icon="lucide:image-plus" />
                      <strong>Guardar screenshot</strong>
                      <span>Texto da imagem vira pesquisável.</span>
                      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={captureScreenshot} disabled={busy} />
                    </label>
                    <form className="thought-card" onSubmit={saveThought}>
                      <iconify-icon icon="lucide:lightbulb" />
                      <strong>Pensamento rápido</strong>
                      <textarea value={thought} onChange={event => setThought(event.target.value)} placeholder="Não é um link? Joga a ideia aqui." rows="3" />
                      <button type="submit" disabled={busy || !thought.trim()}>Guardar ideia</button>
                    </form>
                  </div>

                  {intentTarget ? <section className="everywhere-card intent-inline"><span>Última coisa guardada</span><h3>{displayTitle(intentTarget)}</h3><p>Se quiser, diga em um toque por que ela merece voltar para você.</p><IntentChips value={intentTarget.savedFor || ''} onChange={applyIntent} /></section> : null}
                </div>
              ) : null}

              {tab === 'find' ? (
                <div className="everywhere-stack">
                  <section className="everywhere-card everywhere-card--featured">
                    <div className="everywhere-card-head"><div><span>Memória do seu acervo</span><h3>O que eu já sei sobre…</h3></div><iconify-icon icon="lucide:brain-circuit" /></div>
                    <form className="synthesis-form" onSubmit={runSynthesis}><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Ex.: autenticação React, treino, landing pages…" /><button className="everywhere-primary" disabled={busy}>{busy ? 'Buscando…' : 'Perguntar ao meu acervo'}</button></form>
                  </section>
                  {synthesis ? <SynthesisResult data={synthesis} /> : <div className="everywhere-empty"><iconify-icon icon="lucide:search" /><strong>Não precisa lembrar onde salvou.</strong><span>Descreva a ideia do seu jeito. A busca semântica cruza títulos, notas, tags e Cápsulas.</span></div>}
                </div>
              ) : null}

              {tab === 'more' ? (
                <div className="everywhere-stack">
                  <section className="everywhere-card">
                    <div className="everywhere-card-head"><div><span>Começar sem tela vazia</span><h3>Trazer favoritos antigos</h3></div><iconify-icon icon="lucide:import" /></div>
                    <p>Exporte seus favoritos do navegador em HTML ou CSV. O Guardei deduplica e organiza por baixo.</p>
                    <label className="everywhere-secondary file-action">Escolher HTML ou CSV<input type="file" accept="text/html,.html,text/csv,.csv" onChange={importFile} disabled={busy} /></label>
                  </section>

                  <section className="everywhere-card">
                    <div className="everywhere-card-head"><div><span>Curadoria que viaja</span><h3>Coleções compartilháveis</h3></div><iconify-icon icon="lucide:send" /></div>
                    <form onSubmit={createCollection} className="collection-form"><input value={collectionTitle} onChange={event => setCollectionTitle(event.target.value)} placeholder="Ex.: Começando em React" /><div className="collection-picker">{recentVideos.map(video => <label key={video.id}><input type="checkbox" checked={selectedIds.includes(video.id)} onChange={() => setSelectedIds(current => current.includes(video.id) ? current.filter(id => id !== video.id) : [...current, video.id])} /><span>{displayTitle(video)}</span></label>)}</div><button className="everywhere-primary" disabled={busy}>Criar link público</button></form>
                    {collections.length ? <div className="collection-list">{collections.slice(0, 6).map(item => { const shareUrl = `${window.location.origin}/shared.html?slug=${encodeURIComponent(item.slug)}`; return <div key={item.id}><span><strong>{item.title}</strong><small>{item.itemCount ?? item.items?.length ?? 0} itens</small></span><button type="button" onClick={() => copyText(shareUrl)}><iconify-icon icon="lucide:copy" /> Copiar link</button></div>; })}</div> : null}
                  </section>

                  <section className="everywhere-card">
                    <div className="everywhere-card-head"><div><span>Navegador</span><h3>Extensão em um clique</h3></div><iconify-icon icon="lucide:puzzle" /></div>
                    <p>Gere um token limitado apenas à captura. A extensão nunca recebe sua senha nem acesso amplo à conta.</p>
                    <button className="everywhere-secondary" type="button" onClick={createToken} disabled={busy}>Gerar token da extensão</button>
                    {lastToken ? <div className="secret-box"><code>{lastToken}</code><button type="button" onClick={() => copyText(lastToken)}>Copiar</button></div> : null}
                    <small className="everywhere-muted">{tokens.filter(item => !item.revokedAt).length} token(s) ativo(s). Veja a pasta <code>extension/</code> do projeto para instalar em modo desenvolvedor.</small>
                  </section>

                  <section className="everywhere-card">
                    <div className="everywhere-card-head"><div><span>Automação silenciosa</span><h3>O Guardei cuida por baixo</h3></div><iconify-icon icon="lucide:wand-sparkles" /></div>
                    <div className="preference-list">
                      <Preference label="Digest semanal" text="Resumo curto do que entrou, voltou e pode ser limpo." checked={settings.weeklyDigestEnabled !== false} onChange={() => toggleSetting('weeklyDigestEnabled')} />
                      <Preference label="Arquivo permanente" text="Guarda texto seguro de páginas para o link não virar memória perdida." checked={settings.autoSnapshotEnabled !== false} onChange={() => toggleSetting('autoSnapshotEnabled')} />
                      <Preference label="Ajuda contextual" text="A extensão avisa quando você já guardou algo sobre a página atual." checked={settings.contextAssistEnabled !== false} onChange={() => toggleSetting('contextAssistEnabled')} />
                      <Preference label="Screenshot pesquisável" text="Usa visão/OCR quando disponível." checked={settings.screenshotOcrEnabled !== false} onChange={() => toggleSetting('screenshotOcrEnabled')} />
                    </div>
                  </section>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function TodayTab({ digest, spaces, onRefresh, busy }) {
  const resurfaced = Array.isArray(digest?.resurfaced) ? digest.resurfaced : [];
  const highlights = Array.isArray(digest?.highlights) ? digest.highlights : [];
  return <div className="everywhere-stack">
    <section className="everywhere-card everywhere-card--featured digest-card">
      <div className="everywhere-card-head"><div><span>Sua semana, sem relatório chato</span><h3>{digest ? 'O Guardinho separou o sinal do ruído' : 'Construindo sua memória'}</h3></div><button className="everywhere-icon" type="button" onClick={onRefresh} disabled={busy} aria-label="Atualizar digest"><iconify-icon icon="lucide:refresh-cw" /></button></div>
      <p>{digest?.summary || 'Continue guardando normalmente. Quando houver contexto suficiente, este espaço vira um resumo útil do seu próprio acervo.'}</p>
      {highlights.length ? <div className="digest-highlights">{highlights.slice(0, 3).map(item => <button type="button" key={item.id} onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}><span>{item.category}</span><strong>{item.title}</strong><iconify-icon icon="lucide:arrow-up-right" /></button>)}</div> : null}
    </section>
    {resurfaced.length ? <section className="everywhere-card"><div className="everywhere-card-head"><div><span>Lembra disso?</span><h3>Vale voltar agora</h3></div><iconify-icon icon="lucide:history" /></div><div className="memory-list">{resurfaced.map(item => <button type="button" key={item.id} onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}><iconify-icon icon="lucide:bookmark" /><span><strong>{item.title}</strong><small>Você já tinha sinalizado que isso importava.</small></span><iconify-icon icon="lucide:arrow-right" /></button>)}</div></section> : null}
    <section className="everywhere-card"><div className="everywhere-card-head"><div><span>Sem criar pastas</span><h3>Seus Espaços automáticos</h3></div><iconify-icon icon="lucide:layout-grid" /></div>{spaces.length ? <div className="space-grid">{spaces.map(space => <div key={space.id}><strong>{space.name}</strong><span>{space.count} itens</span><small>{space.reason}</small></div>)}</div> : <p>Os Espaços aparecem sozinhos quando temas começam a se repetir.</p>}</section>
  </div>;
}

function IntentChips({ value, onChange, compact = false }) {
  return <div className={`intent-chips ${compact ? 'compact' : ''}`} aria-label="Motivo para guardar">{INTENTS.map(item => <button key={item.id} type="button" className={value === item.id ? 'active' : ''} onClick={() => onChange(item.id)}><iconify-icon icon={item.icon} />{item.label}</button>)}</div>;
}

function SynthesisResult({ data }) {
  return <section className="everywhere-card synthesis-result"><span className="result-kicker">Seu Guardei responde</span><h3>{data.summary}</h3>{data.themes?.length ? <div className="theme-row">{data.themes.map(theme => <span key={theme.name}>{theme.name} · {theme.count}</span>)}</div> : null}{data.keyPoints?.length ? <div><strong>Ideias que se repetem</strong><ul>{data.keyPoints.slice(0, 7).map((point, index) => <li key={`${index}-${point}`}>{point}</li>)}</ul></div> : null}{data.applications?.length ? <div><strong>Aplicações encontradas</strong><ul>{data.applications.slice(0, 5).map((point, index) => <li key={`${index}-${point}`}>{point}</li>)}</ul></div> : null}{data.sources?.length ? <div className="source-list"><strong>De onde isso veio</strong>{data.sources.map(source => <button type="button" key={source.id} onClick={() => window.open(source.url, '_blank', 'noopener,noreferrer')}><span>{source.title}</span><small>{Math.round(Number(source.score || 0) * 100)}% de relevância</small></button>)}</div> : null}{data.gaps?.length ? <div className="gap-note"><iconify-icon icon="lucide:circle-help" />{data.gaps[0]}</div> : null}</section>;
}

function Preference({ label, text, checked, onChange }) {
  return <label className="preference-item"><span><strong>{label}</strong><small>{text}</small></span><input type="checkbox" checked={checked} onChange={onChange} /></label>;
}

function Tab({ active, icon, children, ...props }) {
  return <button type="button" className={active ? 'active' : ''} {...props}><iconify-icon icon={icon} /><span>{children}</span></button>;
}

function displayTitle(video) {
  return video?.titleCustom || video?.titleAi || video?.titleOriginal || 'Item guardado';
}
