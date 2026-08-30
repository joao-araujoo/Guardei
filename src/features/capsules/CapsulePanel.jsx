import { useEffect, useMemo, useState } from 'react';
import { createCapsule, deleteCapsule, getCapsule, regenerateCapsule } from '../../services/capsuleService.js';
import CapsuleSourceForm from './CapsuleSourceForm.jsx';
import CapsuleStatus from './CapsuleStatus.jsx';

const TABS = [
  ['summary', 'Resumo'],
  ['ideas', 'Principais ideias'],
  ['applications', 'Aplicações'],
  ['questions', 'Perguntas'],
  ['source', 'Fonte da análise']
];

export default function CapsulePanel({ videoId, initialCapsule = null, onCapsuleChange, onNotify }) {
  const [capsule, setCapsule] = useState(initialCapsule);
  const [sourceText, setSourceText] = useState('');
  const [activeTab, setActiveTab] = useState('summary');
  const [loading, setLoading] = useState(true);
  const [processingStatus, setProcessingStatus] = useState(null);
  const [error, setError] = useState('');

  const status = processingStatus || capsule?.status || 'idle';
  const hasCapsule = Boolean(capsule && !['idle'].includes(capsule.status));

  useEffect(() => {
    let active = true;
    setLoading(true);
    setProcessingStatus(null);
    setSourceText('');
    setActiveTab(initialCapsule ? 'summary' : 'source');
    setCapsule(initialCapsule);
    setError('');
    getCapsule(videoId)
      .then(result => {
        if (!active) return;
        setCapsule(result.capsule);
        if (result.capsule) setActiveTab('summary');
        onCapsuleChange?.(result.capsule);
      })
      .catch(requestError => {
        if (!active || requestError.status === 404) return;
        setError(requestError.message);
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [videoId]);

  const tabs = useMemo(() => TABS.filter(([id]) => hasCapsule || id === 'source'), [hasCapsule]);

  function handleTabKeyDown(event, currentIndex) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    const nextId = tabs[nextIndex][0];
    setActiveTab(nextId);
    window.requestAnimationFrame(() => document.getElementById(`capsule-tab-${nextId}`)?.focus());
  }

  async function processCapsule(event, regenerate = false) {
    event?.preventDefault();
    setError('');
    setProcessingStatus('extracting');
    const generatingTimer = window.setTimeout(() => setProcessingStatus('generating'), 700);
    try {
      const payload = { sourceText };
      const result = regenerate ? await regenerateCapsule(videoId, payload) : await createCapsule(videoId, payload);
      setCapsule(result.capsule);
      setSourceText('');
      setActiveTab('summary');
      onCapsuleChange?.(result.capsule);
      onNotify?.(result.capsule?.status === 'limited' ? 'Cápsula criada com cobertura limitada' : 'Cápsula criada com sucesso');
    } catch (requestError) {
      const failedCapsule = requestError.payload?.capsule;
      if (failedCapsule) {
        setCapsule(failedCapsule);
        onCapsuleChange?.(failedCapsule);
      }
      setError(requestError.message || 'Não foi possível concluir a análise.');
    } finally {
      window.clearTimeout(generatingTimer);
      setProcessingStatus(null);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Excluir esta cápsula? O item salvo continuará no seu acervo.')) return;
    setError('');
    try {
      await deleteCapsule(videoId);
      setCapsule(null);
      setActiveTab('source');
      onCapsuleChange?.(null);
      onNotify?.('Cápsula excluída');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function copyText(value, label) {
    try {
      await navigator.clipboard.writeText(value);
      onNotify?.(`${label} copiado`);
    } catch {
      setError('Não foi possível copiar o texto.');
    }
  }

  return (
    <section className="capsule-panel" aria-labelledby="capsule-title">
      <div className="capsule-heading">
        <div>
          <span className="eyebrow">Conhecimento extraído</span>
          <h3 id="capsule-title">Cápsula Inteligente</h3>
        </div>
        {hasCapsule && (
          <div className="capsule-heading-actions">
            <button type="button" className="secondary-btn" disabled={Boolean(processingStatus)} onClick={event => processCapsule(event, true)}>Atualizar análise</button>
            <button type="button" className="text-danger-btn" disabled={Boolean(processingStatus)} onClick={handleDelete}>Excluir cápsula</button>
          </div>
        )}
      </div>

      <CapsuleStatus
        status={status}
        coverage={capsule?.coverage}
        confidence={capsule?.aiConfidence}
        generatedAt={capsule?.generatedAt || capsule?.updatedAt}
      />

      {error && <div className="capsule-error" role="alert">{error} Você pode adicionar um texto manualmente e tentar outra vez.</div>}
      {!error && capsule?.status === 'failed' && capsule.errorMessage && (
        <div className="capsule-error" role="alert">{capsule.errorMessage} Você pode adicionar um texto manualmente e tentar outra vez.</div>
      )}
      {loading && <div className="capsule-skeleton" aria-label="Carregando cápsula"><span /><span /><span /></div>}

      {!loading && !hasCapsule && (
        <div className="capsule-empty">
          <p>Transforme este item em um resumo útil, ideias principais, aplicações e perguntas para revisão.</p>
          <CapsuleSourceForm value={sourceText} onChange={setSourceText} disabled={Boolean(processingStatus)} onSubmit={processCapsule} />
        </div>
      )}

      {!loading && hasCapsule && (
        <>
          <div className="capsule-tabs" role="tablist" aria-label="Seções da cápsula">
            {tabs.map(([id, label], index) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`capsule-tab-${id}`}
                aria-selected={activeTab === id}
                aria-controls={`capsule-panel-${id}`}
                tabIndex={activeTab === id ? 0 : -1}
                className={activeTab === id ? 'active' : ''}
                onClick={() => setActiveTab(id)}
                onKeyDown={event => handleTabKeyDown(event, index)}
              >{label}</button>
            ))}
          </div>

          <div className="capsule-tab-panel" role="tabpanel" id={`capsule-panel-${activeTab}`} aria-labelledby={`capsule-tab-${activeTab}`}>
            {activeTab === 'summary' && (
              <div className="capsule-prose">
                <p>{capsule.summary || 'Resumo não disponível.'}</p>
                {capsule.concepts?.length > 0 && <div className="capsule-concepts">{capsule.concepts.map(concept => <span key={concept}>{concept}</span>)}</div>}
              </div>
            )}
            {activeTab === 'ideas' && <CapsuleList items={capsule.keyPoints} empty="Nenhuma ideia principal foi identificada." copyText={copyText} copyLabel="Ponto principal" />}
            {activeTab === 'applications' && (
              <div className="capsule-columns">
                <CapsuleList title="Possíveis aplicações" items={capsule.practicalApplications} empty="Nenhuma aplicação sugerida." copyText={copyText} copyLabel="Aplicação" />
                <CapsuleList title="Próximas ações" items={capsule.actionItems} empty="Nenhuma ação sugerida." copyText={copyText} copyLabel="Ação" />
              </div>
            )}
            {activeTab === 'questions' && <CapsuleList items={capsule.reflectionQuestions} empty="Nenhuma pergunta de revisão foi gerada." copyText={copyText} copyLabel="Pergunta" />}
            {activeTab === 'source' && (
              <div className="capsule-source-details">
                <p>{capsule.aiRationale || 'A origem da análise não foi detalhada.'}</p>
                {capsule.evidenceSnippets?.length > 0 && (
                  <div className="evidence-list">
                    <h4>Trechos de evidência</h4>
                    {capsule.evidenceSnippets.map((evidence, index) => (
                      <blockquote key={`${evidence.text}-${index}`}>
                        <p>{evidence.text}</p>
                        <cite>{evidence.source || 'Conteúdo analisado'}</cite>
                      </blockquote>
                    ))}
                  </div>
                )}
                <CapsuleSourceForm value={sourceText} onChange={setSourceText} disabled={Boolean(processingStatus)} onSubmit={event => processCapsule(event, true)} submitLabel="Atualizar com este texto" />
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function CapsuleList({ title, items = [], empty, copyText, copyLabel }) {
  return (
    <div className="capsule-list-block">
      {title && <h4>{title}</h4>}
      {items?.length ? (
        <ul className="capsule-list">
          {items.map((item, index) => (
            <li key={`${item}-${index}`}>
              <span>{item}</span>
              <button type="button" onClick={() => copyText(item, copyLabel)} aria-label={`Copiar ${copyLabel.toLowerCase()}`}>Copiar</button>
            </li>
          ))}
        </ul>
      ) : <p className="capsule-muted">{empty}</p>}
    </div>
  );
}
