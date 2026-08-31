import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildAutoVideo } from './lib/aiClassifier.js';
import { executeGuardinhoCommand } from './lib/guardinhoAgent.js';
import { createRepository } from './lib/storage.js';
import { extractSupportedVideoUrl } from './lib/tiktok.js';
import {
  buildSmartNudgeCopy,
  getDisplayTitle,
  pickSmartRecommendation,
  pickStaleNudge
} from './lib/recommendationEngine.js';
import guardeiMascot from './assets/mascot/guardei-mascot.png';
import './smart-layer.css';

const repository = createRepository();
const SMART_SETTINGS = {
  smartNotificationsEnabled: false,
  clipboardSuggestionsEnabled: true,
  guardinhoActionsEnabled: true,
  recommendationMode: 'smart',
  notificationFrequency: 'balanced'
};
const LAST_IN_APP_NUDGE_KEY = 'guardei.smart.last-in-app-nudge.v1';
const LAST_OS_NUDGE_KEY = 'guardei.smart.last-os-nudge.v1';
const LAST_CLIPBOARD_PROMPT_KEY = 'guardei.smart.last-clipboard-prompt.v1';
const NUDGE_SNOOZE_KEY = 'guardei.smart.nudge-snooze.v1';

export default function ProductShell({ children }) {
  const [appRevision, setAppRevision] = useState(0);
  const remountedApp = React.cloneElement(React.Children.only(children), { key: appRevision });

  return (
    <>
      {remountedApp}
      <SmartLayer onVaultChanged={() => setAppRevision(value => value + 1)} />
    </>
  );
}

function SmartLayer({ onVaultChanged }) {
  const [videos, setVideos] = useState([]);
  const [settings, setSettings] = useState(SMART_SETTINGS);
  const [ready, setReady] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [command, setCommand] = useState('');
  const [clipboardSuggestion, setClipboardSuggestion] = useState(null);
  const [nudge, setNudge] = useState(null);
  const [notice, setNotice] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Agora eu também consigo agir no seu acervo. Me pede para salvar, organizar, marcar, arquivar ou recomendar alguma coisa. ✨' }
  ]);
  const mountedRef = useRef(true);
  const noticeTimerRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const loadSnapshot = useCallback(async () => {
    try {
      const [nextVideos, nextSettings] = await Promise.all([
        repository.listVideos(),
        repository.getSettings?.() || SMART_SETTINGS
      ]);
      if (!mountedRef.current) return false;
      setVideos(Array.isArray(nextVideos) ? nextVideos : []);
      setSettings({ ...SMART_SETTINGS, ...(nextSettings || {}) });
      setReady(true);
      return true;
    } catch (error) {
      if (error?.status !== 401) console.warn('Guardei smart layer indisponível:', error);
      if (mountedRef.current) setReady(false);
      return false;
    }
  }, []);

  const recommendation = useMemo(() => settings.recommendationMode === 'smart' ? pickSmartRecommendation(videos) : null, [settings.recommendationMode, videos]);

  useEffect(() => {
    mountedRef.current = true;
    loadSnapshot();
    const interval = window.setInterval(loadSnapshot, 15000);
    const handleFocus = () => loadSnapshot();
    window.addEventListener('focus', handleFocus);
    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    };
  }, [loadSnapshot]);

  useEffect(() => {
    if (!ready || !videos.length) return;
    const snoozedUntil = Number(localStorage.getItem(NUDGE_SNOOZE_KEY) || 0);
    if (Date.now() < snoozedUntil) return;

    const lastNudgeAt = Number(localStorage.getItem(LAST_IN_APP_NUDGE_KEY) || 0);
    const minimumGap = settings.notificationFrequency === 'frequent' ? 6 : settings.notificationFrequency === 'light' ? 36 : 18;
    if (Date.now() - lastNudgeAt < minimumGap * 60 * 60 * 1000) return;

    const candidate = pickStaleNudge(videos, { minAgeDays: 7 });
    if (!candidate) return;
    const copy = buildSmartNudgeCopy(candidate.video);
    setNudge({ ...candidate, copy });
    localStorage.setItem(LAST_IN_APP_NUDGE_KEY, String(Date.now()));

    if (settings.smartNotificationsEnabled) {
      maybeShowSystemNotification(candidate.video, copy, settings.notificationFrequency).catch(() => {});
    }
  }, [ready, settings.notificationFrequency, settings.smartNotificationsEnabled, videos]);

  useEffect(() => {
    if (!ready || !settings.clipboardSuggestionsEnabled) return;

    const inspect = () => inspectClipboard({ interactive: false });
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') window.setTimeout(inspect, 350);
    };
    window.addEventListener('focus', inspect);
    document.addEventListener('visibilitychange', handleVisibility);
    window.setTimeout(inspect, 700);

    const params = new URLSearchParams(window.location.search);
    if (params.has('clipboard')) {
      setPanelOpen(true);
      window.setTimeout(() => inspectClipboard({ interactive: true }), 500);
    }

    return () => {
      window.removeEventListener('focus', inspect);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [ready, settings.clipboardSuggestionsEnabled, videos]);

  useEffect(() => {
  const handleOpenGuardinho = event => {
    const detail = event?.detail || {};
    if (detail.assistantMessage) {
      setMessages(items => [...items, { role: 'assistant', text: String(detail.assistantMessage) }].slice(-12));
    }
    if (detail.command) setCommand(String(detail.command));
    setPanelOpen(true);
  };

  window.addEventListener('guardei:open-guardinho', handleOpenGuardinho);
  return () => window.removeEventListener('guardei:open-guardinho', handleOpenGuardinho);
}, []);

  useEffect(() => {
  if (!panelOpen) return undefined;

  const previousOverflow = document.body.style.overflow;
  const previousFocus = document.activeElement;
  const focusableSelector = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
  const handleKeyDown = event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setPanelOpen(false);
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = panelRef.current?.querySelectorAll(focusableSelector);
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  document.body.style.overflow = 'hidden';
  window.addEventListener('keydown', handleKeyDown);
  window.requestAnimationFrame(() => panelRef.current?.querySelector(focusableSelector)?.focus());

  return () => {
    document.body.style.overflow = previousOverflow;
    window.removeEventListener('keydown', handleKeyDown);
    if (previousFocus instanceof HTMLElement && document.contains(previousFocus)) previousFocus.focus();
    else triggerRef.current?.focus?.();
  };
}, [panelOpen]);

  async function inspectClipboard({ interactive = false } = {}) {
    if (!settings.clipboardSuggestionsEnabled || !navigator.clipboard?.readText || !window.isSecureContext) return null;

    try {
      if (!interactive && navigator.permissions?.query) {
        let permission;
        try {
          permission = await navigator.permissions.query({ name: 'clipboard-read' });
        } catch {
          return null;
        }
        if (permission.state !== 'granted') return null;
      }

      const text = await navigator.clipboard.readText();
      const url = extractSupportedVideoUrl(text);
      if (!url) {
        if (interactive) flash('Não encontrei um link válido no clipboard.');
        return null;
      }

      const existing = videos.find(video => video.url === url || video.canonicalUrl === url);
      if (existing) {
        if (interactive) flash('Esse link já está no seu Guardei.');
        return existing;
      }

      const lastPrompt = safeJson(localStorage.getItem(LAST_CLIPBOARD_PROMPT_KEY));
      if (!interactive && lastPrompt?.url === url && Date.now() - Number(lastPrompt.at || 0) < 6 * 60 * 60 * 1000) return null;

      localStorage.setItem(LAST_CLIPBOARD_PROMPT_KEY, JSON.stringify({ url, at: Date.now() }));
      setClipboardSuggestion({ url, sourceText: text });
      return { url };
    } catch {
      if (interactive) flash('O navegador bloqueou o clipboard. Use o botão de colar do Guardei ou permita o acesso.');
      return null;
    }
  }

  async function saveClipboardSuggestion() {
    if (!clipboardSuggestion?.url || busy) return;
    setBusy(true);
    try {
      const video = await buildAutoVideo({
        url: clipboardSuggestion.url,
        text: clipboardSuggestion.sourceText,
        origin: 'clipboard-smart'
      });
      const result = await repository.addVideo(video);
      const saved = result?.video || video;
      setClipboardSuggestion(null);
      flash(result?.duplicated ? 'Esse link já estava guardado.' : `Guardei “${getDisplayTitle(saved)}” sem enrolação. ✨`);
      await loadSnapshot();
      onVaultChanged();
    } catch {
      flash('Não consegui salvar agora. Nada foi perdido: o link continua no clipboard.');
    } finally {
      setBusy(false);
    }
  }

  async function runCommand(event, forcedCommand = '') {
    event?.preventDefault?.();
    const text = String(forcedCommand || command).trim();
    if (!text || busy || !settings.guardinhoActionsEnabled) return;

    setMessages(items => [...items, { role: 'user', text }].slice(-12));
    setCommand('');
    setBusy(true);
    try {
      const result = await executeGuardinhoCommand({ message: text, videos, repository });
      setMessages(items => [...items, { role: 'assistant', text: result.answer }].slice(-12));
      if (result.mutated) {
        await loadSnapshot();
        onVaultChanged();
      }
      if (result.recommendation?.video) setNudge(null);
    } catch (error) {
      console.error(error);
      setMessages(items => [...items, { role: 'assistant', text: 'Deu ruim aqui por um segundo 😵‍💫. Não alterei nada. Tenta de novo.' }].slice(-12));
    } finally {
      setBusy(false);
    }
  }

  async function markNudgeWatched() {
    const video = nudge?.video;
    if (!video || busy) return;
    setBusy(true);
    try {
      const now = new Date().toISOString();
      await repository.updateVideo(video.id, {
        consumedAt: now,
        watchedAt: now,
        watchCount: Number(video.watchCount || 0) + 1,
        watchedSeconds: Number(video.watchedSeconds || 0) || 300
      });
      setNudge(null);
      flash('Boa. Esse saiu da fila. ✅');
      await loadSnapshot();
      onVaultChanged();
    } catch {
      flash('Não consegui atualizar agora.');
    } finally {
      setBusy(false);
    }
  }

  function snoozeNudge(hours = 24) {
    localStorage.setItem(NUDGE_SNOOZE_KEY, String(Date.now() + hours * 60 * 60 * 1000));
    setNudge(null);
    flash('Fechado. O Guardinho vai fingir que esqueceu por enquanto. 🤐');
  }

  async function enableNotifications() {
    if (!('Notification' in window)) {
      flash('Este navegador não oferece notificações web.');
      return;
    }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        await persistSettings({ smartNotificationsEnabled: false });
        flash('Sem problema. Vou continuar usando lembretes dentro do app.');
        return;
      }
      await persistSettings({ smartNotificationsEnabled: true });
      await registerPeriodicSmartReminders();
      const registration = await navigator.serviceWorker?.ready;
      await registration?.showNotification?.('🧠 Guardinho ativado', {
        body: 'Agora eu posso cutucar você quando um link bom estiver criando poeira.',
        icon: '/icons/guardei-icon.png',
        badge: '/icons/guardei-icon-transparent.png',
        tag: 'guardei-notifications-enabled',
        data: { url: '/' }
      });
      flash('Notificações inteligentes ativadas.');
    } catch {
      flash('Não consegui ativar as notificações neste navegador.');
    } finally {
      setBusy(false);
    }
  }

  async function disableNotifications() {
    await persistSettings({ smartNotificationsEnabled: false });
    flash('Notificações do Guardinho pausadas.');
  }

  async function toggleClipboardSuggestions() {
    const next = !settings.clipboardSuggestionsEnabled;
    await persistSettings({ clipboardSuggestionsEnabled: next });
    if (!next) setClipboardSuggestion(null);
    flash(next ? 'Sugestões de clipboard ativadas.' : 'Sugestões de clipboard pausadas.');
  }

  async function toggleGuardinhoActions() {
    const next = !settings.guardinhoActionsEnabled;
    try {
      await persistSettings({ guardinhoActionsEnabled: next });
      flash(next ? 'Ações do Guardinho ativadas.' : 'Ações do Guardinho pausadas.');
    } catch {
      flash('Não consegui salvar essa preferência.');
    }
  }

  async function updateSmartPreference(key, value) {
    try {
      await persistSettings({ [key]: value });
    } catch {
      flash('Não consegui salvar essa preferência.');
    }
  }

  async function persistSettings(patch) {
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      const saved = await repository.saveSettings?.(next);
      if (saved) setSettings({ ...SMART_SETTINGS, ...saved });
    } catch {
      setSettings(settings);
      throw new Error('settings-save-failed');
    }
  }

  function openVideo(video) {
    if (!video?.url) return;
    window.open(video.url, '_blank', 'noopener,noreferrer');
  }

  function flash(text) {
    setNotice(text);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(''), 3200);
  }

  if (!ready) return null;

  return (
    <div className="smart-layer-root">
      {notice ? <div className="smart-flash" role="status">{notice}</div> : null}

      {clipboardSuggestion ? (
        <SmartToast
          eyebrow="Clipboard detectado"
          title="👀 Isso aí parece guardável"
          text="Você já copiou o link. Quer que eu faça o resto e organize automaticamente?"
          primaryLabel={busy ? 'Guardando…' : 'Guardar agora'}
          onPrimary={saveClipboardSuggestion}
          secondaryLabel="Ignorar"
          onSecondary={() => setClipboardSuggestion(null)}
        />
      ) : null}

      {!clipboardSuggestion && nudge?.copy ? (
        <SmartToast
          eyebrow="Lembrete do Guardinho"
          title={nudge.copy.title}
          text={nudge.copy.body}
          primaryLabel="Abrir"
          onPrimary={() => openVideo(nudge.video)}
          secondaryLabel="Já vi"
          onSecondary={markNudgeWatched}
          tertiaryLabel="Depois"
          onTertiary={() => snoozeNudge(24)}
        />
      ) : null}

      <button
        className="smart-guardinho-trigger"
        ref={triggerRef}
        type="button"
        onClick={() => setPanelOpen(true)}
        aria-label="Abrir Guardinho inteligente"
      >
        <img src={guardeiMascot} alt="" />
        <span>
          <strong>Guardinho</strong>
          <small>agora ele faz coisas</small>
        </span>
        <iconify-icon icon="lucide:sparkles" />
      </button>

      {panelOpen ? (
        <div className="smart-panel-backdrop" onMouseDown={event => event.target === event.currentTarget && setPanelOpen(false)}>
          <aside className="smart-panel" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="guardinho-panel-title">
            <header className="smart-panel-header">
              <div className="smart-panel-identity">
                <img src={guardeiMascot} alt="" />
                <div>
                  <span>Seu acervo, menos passivo</span>
                  <h2 id="guardinho-panel-title">Guardinho inteligente</h2>
                </div>
              </div>
              <button className="smart-icon-button" type="button" onClick={() => setPanelOpen(false)} aria-label="Fechar Guardinho">
                <iconify-icon icon="lucide:x" />
              </button>
            </header>

            <div className="smart-panel-scroll">
              {recommendation ? (
                <section className="smart-recommendation-card">
                  <div className="smart-section-heading">
                    <span>Recomendação automática</span>
                    <iconify-icon icon="lucide:wand-sparkles" />
                  </div>
                  <h3>{getDisplayTitle(recommendation.video)}</h3>
                  <p>{recommendation.reasons?.length ? `Eu escolhi porque ${recommendation.reasons.join(', ')}.` : 'Eu escolhi pelo contexto do seu acervo e pelo momento do dia.'}</p>
                  <div className="smart-inline-actions">
                    <button type="button" className="smart-primary-button" onClick={() => openVideo(recommendation.video)}>Abrir agora</button>
                    <button type="button" className="smart-secondary-button" onClick={() => runCommand(null, `marca "${getDisplayTitle(recommendation.video)}" como visto`)}>Marcar visto</button>
                  </div>
                </section>
              ) : (
                <section className="smart-empty-card">
                  <iconify-icon icon="lucide:inbox" />
                  <div><strong>{settings.recommendationMode === 'manual' ? 'Recomendação automática pausada' : 'Nada para recomendar ainda'}</strong><span>{settings.recommendationMode === 'manual' ? 'Use “Me recomenda” quando quiser uma escolha sob demanda.' : 'Salve alguns links e eu começo a aprender o que merece voltar para você.'}</span></div>
                </section>
              )}

              <section className="smart-settings-row" aria-label="Automação inteligente">
                <button type="button" onClick={settings.smartNotificationsEnabled ? disableNotifications : enableNotifications}>
                  <iconify-icon icon={settings.smartNotificationsEnabled ? 'lucide:bell-ring' : 'lucide:bell'} />
                  <span><strong>Lembretes</strong><small>{settings.smartNotificationsEnabled ? 'Ativos' : 'Ativar'}</small></span>
                </button>
                <button type="button" onClick={toggleClipboardSuggestions}>
                  <iconify-icon icon="lucide:clipboard" />
                  <span><strong>Clipboard</strong><small>{settings.clipboardSuggestionsEnabled ? 'Automático' : 'Pausado'}</small></span>
                </button>
                <button type="button" onClick={toggleGuardinhoActions}>
                  <iconify-icon icon={settings.guardinhoActionsEnabled ? 'lucide:wand-sparkles' : 'lucide:pause'} />
                  <span><strong>Ações</strong><small>{settings.guardinhoActionsEnabled ? 'Ativas' : 'Pausadas'}</small></span>
                </button>
                <button type="button" onClick={() => inspectClipboard({ interactive: true })}>
                  <iconify-icon icon="lucide:clipboard-check" />
                  <span><strong>Checar agora</strong><small>1 toque</small></span>
                </button>
              </section>

              <section className="smart-preference-controls" aria-label="Preferências do Guardinho">
                <label>
                  <span>Recomendação</span>
                  <select value={settings.recommendationMode || 'smart'} onChange={event => updateSmartPreference('recommendationMode', event.target.value)}>
                    <option value="smart">Automática</option>
                    <option value="manual">Só quando eu pedir</option>
                  </select>
                </label>
                <label>
                  <span>Frequência de lembretes</span>
                  <select value={settings.notificationFrequency || 'balanced'} onChange={event => updateSmartPreference('notificationFrequency', event.target.value)}>
                    <option value="light">Leve</option>
                    <option value="balanced">Equilibrada</option>
                    <option value="frequent">Frequente</option>
                  </select>
                </label>
              </section>

              <section className="smart-quick-actions">
                <span className="smart-section-label">Ações rápidas</span>
                <div>
                  <button type="button" disabled={busy || !settings.guardinhoActionsEnabled} onClick={() => runCommand(null, 'me recomenda algo')}><iconify-icon icon="lucide:target" />Me recomenda</button>
                  <button type="button" disabled={busy || !settings.guardinhoActionsEnabled} onClick={() => runCommand(null, 'organiza o inbox')}><iconify-icon icon="lucide:wand-sparkles" />Organizar inbox</button>
                  <button type="button" disabled={busy} onClick={() => inspectClipboard({ interactive: true })}><iconify-icon icon="lucide:link" />Guardar copiado</button>
                </div>
              </section>

              <section className="smart-chat" aria-label="Conversa com Guardinho">
                <div className="smart-chat-messages">
                  {messages.map((message, index) => (
                    <div key={`${message.role}-${index}`} className={`smart-message smart-message--${message.role}`}>
                      {message.role === 'assistant' ? <img src={guardeiMascot} alt="" /> : null}
                      <p>{message.text}</p>
                    </div>
                  ))}
                  {busy ? <div className="smart-message smart-message--assistant smart-message--thinking"><img src={guardeiMascot} alt="" /><p>Mexendo nas gavetinhas…</p></div> : null}
                </div>

                <form className="smart-command-form" onSubmit={runCommand}>
                  <input
                    value={command}
                    onChange={event => setCommand(event.target.value)}
                    placeholder='Ex.: “marca o vídeo de React como visto”'
                    aria-label="Pedir uma ação ao Guardinho"
                    disabled={busy || !settings.guardinhoActionsEnabled}
                  />
                  <button type="submit" disabled={busy || !command.trim()} aria-label="Enviar">
                    <iconify-icon icon="lucide:arrow-up" />
                  </button>
                </form>
                <p className="smart-command-hint">{settings.guardinhoActionsEnabled ? 'Ações são intencionais e reversíveis quando possível. O Guardinho não apaga itens por comando.' : 'As ações estão pausadas. Reative acima para o Guardinho alterar o acervo.'}</p>
              </section>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function SmartToast({ eyebrow, title, text, primaryLabel, onPrimary, secondaryLabel, onSecondary, tertiaryLabel, onTertiary }) {
  return (
    <aside className="smart-toast" aria-live="polite">
      <img className="smart-toast-mascot" src={guardeiMascot} alt="" />
      <div className="smart-toast-copy">
        <span>{eyebrow}</span>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
      <div className="smart-toast-actions">
        <button type="button" className="smart-primary-button" onClick={onPrimary}>{primaryLabel}</button>
        {secondaryLabel ? <button type="button" className="smart-secondary-button" onClick={onSecondary}>{secondaryLabel}</button> : null}
        {tertiaryLabel ? <button type="button" className="smart-link-button" onClick={onTertiary}>{tertiaryLabel}</button> : null}
      </div>
    </aside>
  );
}

async function maybeShowSystemNotification(video, copy, frequency) {
  if (!('Notification' in window) || Notification.permission !== 'granted' || !navigator.serviceWorker) return;
  const lastAt = Number(localStorage.getItem(LAST_OS_NUDGE_KEY) || 0);
  const hours = frequency === 'frequent' ? 12 : frequency === 'light' ? 72 : 24;
  if (Date.now() - lastAt < hours * 60 * 60 * 1000) return;

  const registration = await navigator.serviceWorker.ready;
  registration.active?.postMessage({
    type: 'SHOW_SMART_NOTIFICATION',
    payload: {
      title: copy.title,
      body: copy.body,
      videoId: video.id,
      url: video.url
    }
  });
  localStorage.setItem(LAST_OS_NUDGE_KEY, String(Date.now()));
}

async function registerPeriodicSmartReminders() {
  if (!navigator.serviceWorker) return false;
  const registration = await navigator.serviceWorker.ready;
  if (!registration?.periodicSync) return false;

  try {
    if (navigator.permissions?.query) {
      const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (status.state !== 'granted') return false;
    }
    await registration.periodicSync.register('guardei-smart-reminders-v1', {
      minInterval: 12 * 60 * 60 * 1000
    });
    return true;
  } catch {
    return false;
  }
}

function safeJson(value) {
  try {
    return JSON.parse(value || 'null');
  } catch {
    return null;
  }
}
