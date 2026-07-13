import { useEffect, useMemo, useState } from 'react';
import { knowledgeService } from '../../services/knowledgeService.js';

function percent(value) { return value === null || value === undefined ? 'Sem base' : `${Math.round(value * 100)}%`; }
function topicName(id, categories) { return categories?.find(item => item.id === id)?.label || id || 'Geral'; }

export default function KnowledgeDashboard({ categories = [], refreshKey = 0, onMetrics, onNotify }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    knowledgeService.dashboard(days).then(result => { if (!active) return; setData(result); onMetrics?.(result.metrics); }).catch(loadError => { if (active) { setError(loadError.message); onNotify?.(loadError.message); } }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [days, refreshKey]);

  const maxTrend = useMemo(() => Math.max(1, ...(data?.trend || []).map(row => row.reviews + row.applications + row.consumed)), [data]);
  if (loading) return <div className="knowledge-skeleton">Calculando métricas baseadas nos seus registros...</div>;
  if (error) return <div className="compact-empty"><strong>Dashboard de conhecimento indisponível</strong><small>{error}</small></div>;
  const metrics = data?.metrics || {};

  return (
    <section className="knowledge-dashboard" aria-labelledby="knowledge-dashboard-title">
      <div className="knowledge-dashboard-head"><div><span className="eyebrow">Aprendizado que deixa rastro</span><h2 id="knowledge-dashboard-title">Dashboard de conhecimento</h2><p>{(data?.summary || []).join(' ')}</p></div><label><span>Período</span><select value={days} onChange={event => setDays(Number(event.target.value))}><option value="7">7 dias</option><option value="30">30 dias</option><option value="90">90 dias</option><option value="365">1 ano</option></select></label></div>

      <div className="knowledge-metrics-grid">
        <Metric label="Cartões revisados" value={metrics.cardsReviewed || 0} help="Total de tentativas registradas no período histórico disponível." />
        <Metric label="Cartões pendentes" value={metrics.cardsPending || 0} help="Cartões ativos cuja próxima revisão já chegou." />
        <Metric label="Taxa de recordação" value={percent(metrics.recallRate)} help={metrics.recallAttempts ? `Baseada em ${metrics.recallAttempts} tentativa(s): Bom e Fácil contam como recordação.` : 'A taxa só aparece após existir ao menos uma tentativa real.'} />
        <Metric label="Confiança média" value={metrics.averageConfidence ?? 'Sem base'} help={metrics.confidenceSamples ? `Média de ${metrics.confidenceSamples} reflexão(ões), numa escala de 1 a 5.` : 'Nenhuma confiança foi registrada em reflexões.'} />
        <Metric label="Aplicações planejadas" value={metrics.applicationsPlanned || 0} help="Compromissos planejados ou em andamento." />
        <Metric label="Aplicações concluídas" value={metrics.applicationsCompleted || 0} help="Ações finalizadas com evidência ou reflexão." />
        <Metric label="Conteúdos consumidos" value={metrics.contentsConsumed || 0} help="Itens com consumedAt ou o watchedAt legado." />
        <Metric label="Realmente aplicados" value={metrics.contentsApplied || 0} help="Somente itens com aplicação concluída explicitamente." />
      </div>

      {!!metrics.legacyApplied && <p className="legacy-note">{metrics.legacyApplied} item(ns) mantêm a marca histórica “Aplicado”. Eles continuam acessíveis, mas não entram como aplicação comprovada.</p>}

      <div className="knowledge-dashboard-split">
        <section className="knowledge-chart-card" aria-labelledby="knowledge-evolution-title"><div><h3 id="knowledge-evolution-title">Evolução no período</h3><p>As barras resumem consumo, revisões e aplicações; a lista abaixo contém os mesmos dados em texto.</p></div><div className="mini-trend" aria-hidden="true">{(data?.trend || []).map(row => <span key={row.date} title={`${row.date}: ${row.reviews} revisões, ${row.applications} aplicações, ${row.consumed} consumidos`} style={{ height: `${Math.max(4, ((row.reviews + row.applications + row.consumed) / maxTrend) * 100)}%` }} />)}</div><details><summary>Ver evolução em lista</summary><ul className="trend-text-list">{(data?.trend || []).filter(row => row.reviews || row.applications || row.consumed).map(row => <li key={row.date}><time>{new Date(`${row.date}T12:00:00`).toLocaleDateString('pt-BR')}</time><span>{row.reviews} revisão(ões), {row.applications} aplicação(ões), {row.consumed} consumo(s)</span></li>)}</ul></details></section>

        <section className="knowledge-topic-card"><h3>Onde está mais difícil</h3>{data?.difficultTopics?.length ? <ul>{data.difficultTopics.map(topic => <li key={topic.topic}><span>{topicName(topic.topic, categories)}</span><strong>{percent(topic.recallRate)}</strong><small>{topic.attempts} tentativa(s)</small></li>)}</ul> : <p>Ainda não há tentativas suficientes para identificar dificuldade.</p>}<h3>Melhor recordação</h3>{data?.bestRetentionTopics?.length ? <ul>{data.bestRetentionTopics.map(topic => <li key={topic.topic}><span>{topicName(topic.topic, categories)}</span><strong>{percent(topic.recallRate)}</strong><small>{topic.attempts} tentativa(s)</small></li>)}</ul> : <p>São necessárias ao menos duas tentativas por assunto.</p>}</section>
      </div>
    </section>
  );
}

function Metric({ label, value, help }) {
  return <article className="knowledge-metric"><span>{label}</span><strong>{value}</strong><p>{help}</p></article>;
}
