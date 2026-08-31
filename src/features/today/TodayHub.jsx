import { useEffect, useState } from 'react';
import { knowledgeService } from '../../services/knowledgeService.js';

const SESSION_OPTIONS = [
  { id: '2', label: '2 minutos', key: 'two' },
  { id: '5', label: '5 minutos', key: 'five' },
  { id: '10', label: '10 minutos', key: 'ten' },
  { id: 'complete', label: 'Completa', key: 'full' }
];

export default function TodayHub({ refreshKey = 0, onStartReview, onOpenVideo, onOpenPath, onOpenApplications, onNotify, onData }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, [refreshKey]);
  async function load() {
    setLoading(true);
    setError('');
    try { const result = await knowledgeService.today(); setData(result); onData?.(result); }
    catch (loadError) { setError(loadError.message); onNotify?.(loadError.message); }
    finally { setLoading(false); }
  }

  function begin(option) {
    const session = data?.sessions?.[option.key];
    const cards = (session?.activities || []).filter(activity => activity.type === 'card').map(activity => activity.item);
    if (cards.length) { onStartReview?.({ minutes: option.id, cards }); return; }
    const first = session?.activities?.[0];
    if (first?.type === 'application') onOpenApplications?.(first.item.video?.id);
    else if (first?.type === 'path') onOpenPath?.(first.item.pathId);
    else if (first?.type === 'decision') onOpenVideo?.(first.item.id);
    else onNotify?.('Seu ciclo está em dia para esta duração.');
  }

  if (loading) return <section className="today-hub"><div className="knowledge-skeleton">Organizando o que merece atenção hoje...</div></section>;
  if (error) return <section className="today-hub"><div className="compact-empty"><strong>Não foi possível carregar a central Hoje</strong><small>{error}</small><button className="secondary-btn" type="button" onClick={load}>Tentar novamente</button></div></section>;

  const counts = data?.counts || {};
  const action = data?.nextAction || {};
  const reviewedToday = Number(counts.reviewedToday || 0);
  const dailyTarget = Math.max(1, Number(counts.dailyReviewTarget || 3));
  return (
    <section className="today-hub" aria-labelledby="today-hub-title">
      <header className="today-hub-head">
        <div><span className="eyebrow">Ciclo de Conhecimento</span><h2 id="today-hub-title">Hoje</h2><p>Uma visão curta do que pode ajudar você a decidir, lembrar e aplicar — sem criar obrigação artificial.</p></div>
        <div className="today-hub-badges">
          <span className="review-badge" aria-label={`${reviewedToday} de ${dailyTarget} revisões da meta diária concluídas`}>{reviewedToday}/{dailyTarget} revisões hoje</span>
          {!!counts.dueCards && <span className="review-badge" aria-label={`${counts.dueCards} cartões pendentes`}>{counts.dueCards} para recordar</span>}
        </div>
      </header>

      <article className={`next-action action-${action.type || 'empty'}`}>
        <span className="next-action-kicker">Próxima ação recomendada</span>
        <h3>{action.title}</h3>
        <p>{action.description}</p>
        {action.type === 'cards' && <button className="primary-btn" type="button" onClick={() => begin(SESSION_OPTIONS[1])}>Começar revisão curta</button>}
        {action.type === 'application' && <button className="primary-btn" type="button" onClick={() => onOpenApplications?.(data.applications?.[0]?.video?.id)}>Ver aplicação</button>}
        {action.type === 'path' && <button className="primary-btn" type="button" onClick={() => onOpenPath?.(action.targetId)}>Continuar trilha</button>}
        {action.type === 'decision' && data.decisions?.[0] && <button className="primary-btn" type="button" onClick={() => onOpenVideo?.(data.decisions[0].id)}>Decidir primeiro item</button>}
      </article>

      <div className="today-count-grid">
        <button type="button" onClick={() => data.decisions?.[0] && onOpenVideo?.(data.decisions[0].id)}><span>Conteúdos para decidir</span><strong>{counts.decisions || 0}</strong><small>Itens ainda no inbox</small></button>
        <button type="button" onClick={() => counts.dueCards && begin(SESSION_OPTIONS[1])}><span>Cartões para recordar</span><strong>{counts.dueCards || 0}</strong><small>Vencidos ou prontos hoje</small></button>
        <button type="button" onClick={() => onOpenApplications?.(data.applications?.[0]?.video?.id)}><span>Aplicações pendentes</span><strong>{counts.applications || 0}</strong><small>{counts.overdueApplications ? `${counts.overdueApplications} atrasada(s)` : 'Planejadas ou em andamento'}</small></button>
        <button type="button" onClick={() => data.paths?.[0] && onOpenPath?.(data.paths[0].pathId)}><span>Trilhas em andamento</span><strong>{counts.activePaths || 0}</strong><small>Com uma próxima ação definida</small></button>
      </div>

      <div className="session-picker" aria-labelledby="session-picker-title"><div><strong id="session-picker-title">Quanto tempo você tem?</strong><small>A sessão seleciona uma quantidade compatível de atividades reais.</small></div><div className="session-options">{SESSION_OPTIONS.map(option => <button type="button" key={option.id} onClick={() => begin(option)}>{option.label}<small>{data.sessions?.[option.key]?.activities?.length || 0} atividade(s)</small></button>)}</div></div>
    </section>
  );
}
