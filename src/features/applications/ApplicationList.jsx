import { useEffect, useState } from 'react';
import ApplicationForm from './ApplicationForm.jsx';
import { knowledgeService } from '../../services/knowledgeService.js';

const STATUS_LABEL = { planned: 'Planejada', in_progress: 'Em andamento', completed: 'Concluída', dismissed: 'Descartada' };

export default function ApplicationList({ video, paths = [], onChanged, onNotify }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [completingId, setCompletingId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [video.id]);
  async function load() {
    setLoading(true);
    try { const data = await knowledgeService.applications({ videoId: video.id, limit: 50 }); setItems(data.applications || []); }
    catch (error) { onNotify?.(error.message); }
    finally { setLoading(false); }
  }
  async function create(payload) {
    setSaving(true);
    try { const data = await knowledgeService.createApplication(video.id, payload); setItems(current => [data.application, ...current]); setCreating(false); onChanged?.(data.application); onNotify?.('Compromisso criado'); }
    catch (error) { onNotify?.(error.message); }
    finally { setSaving(false); }
  }
  async function update(id, payload) {
    setSaving(true);
    try { const data = await knowledgeService.updateApplication(id, payload); setItems(current => current.map(item => item.id === id ? data.application : item)); setEditingId(null); setCompletingId(null); onChanged?.(data.application); onNotify?.(data.application.status === 'completed' ? 'Aplicação concluída e registrada' : 'Compromisso atualizado'); }
    catch (error) { onNotify?.(error.message); }
    finally { setSaving(false); }
  }
  async function remove(item) {
    if (!window.confirm('Excluir este compromisso de aplicação?')) return;
    try { await knowledgeService.deleteApplication(item.id); setItems(current => current.filter(candidate => candidate.id !== item.id)); onChanged?.(); }
    catch (error) { onNotify?.(error.message); }
  }

  return (
    <section className="knowledge-panel application-panel">
      <div className="knowledge-panel-head"><div><span className="eyebrow">Da ideia à prática</span><h3>Compromissos de aplicação</h3></div><button className="secondary-btn" type="button" onClick={() => setCreating(value => !value)}>Criar ação prática</button></div>
      <p className="knowledge-panel-copy">Consumir não significa aplicar. O item só entra como realmente aplicado depois que uma ação for concluída com evidência ou reflexão.</p>
      {video.applicationStatus === 'legacy_applied' && <p className="legacy-note">Este item já possuía o status antigo “Aplicado”. Ele foi preservado como histórico, mas não entra nas métricas de aplicação real até uma ação ser concluída.</p>}
      {creating && <ApplicationForm paths={paths} suggestion={video.capsule?.practicalApplications?.[0] || video.applicationIdea || ''} onSave={create} onCancel={() => setCreating(false)} saving={saving} />}
      {loading ? <div className="knowledge-skeleton">Carregando aplicações...</div> : !items.length ? <div className="compact-empty"><strong>Nenhuma aplicação planejada</strong><small>Crie somente quando houver uma ação concreta que faça sentido.</small></div> : <div className="application-list">{items.map(item => <article key={item.id} className={`application-item status-${item.status}`}><div className="application-item-head"><div><span>{STATUS_LABEL[item.status]}</span><h4>{item.title}</h4></div>{item.dueAt && <time dateTime={item.dueAt}>{new Date(item.dueAt).toLocaleDateString('pt-BR')}</time>}</div>{item.description && <p>{item.description}</p>}{item.learningPath?.title && <small>Trilha: {item.learningPath.title}</small>}{item.status === 'completed' && <div className="application-proof"><strong>Evidência registrada</strong><p>{item.evidenceText || item.reflection || 'Link de evidência informado.'}</p>{item.evidenceUrl && <a href={item.evidenceUrl} target="_blank" rel="noreferrer">Abrir evidência</a>}</div>}{editingId === item.id || completingId === item.id ? <ApplicationForm application={item} paths={paths} completing={completingId === item.id} onSave={payload => update(item.id, payload)} onCancel={() => { setEditingId(null); setCompletingId(null); }} saving={saving} /> : <div className="inline-actions"><button className="ghost-btn" type="button" onClick={() => setEditingId(item.id)}>Editar</button>{!['completed','dismissed'].includes(item.status) && <button className="primary-btn-small" type="button" onClick={() => setCompletingId(item.id)}>Registrar aplicação</button>}<button className="ghost-btn danger-text" type="button" onClick={() => remove(item)}>Excluir</button></div>}</article>)}</div>}
    </section>
  );
}
