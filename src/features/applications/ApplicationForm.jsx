import { useEffect, useState } from 'react';

const empty = { title: '', description: '', dueAt: '', status: 'planned', evidenceUrl: '', evidenceText: '', reflection: '', reviewAgain: false, learningPathId: '' };

export default function ApplicationForm({ application, paths = [], suggestion = '', completing = false, onSave, onCancel, saving = false }) {
  const [form, setForm] = useState(empty);
  useEffect(() => {
    setForm({
      ...empty,
      ...application,
      title: application?.title || suggestion || '',
      dueAt: application?.dueAt ? new Date(application.dueAt).toISOString().slice(0, 16) : '',
      status: completing ? 'completed' : application?.status || 'planned'
    });
  }, [application?.id, suggestion, completing]);

  function submit(event) {
    event.preventDefault();
    onSave?.({
      ...form,
      dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
      learningPathId: form.learningPathId || null
    });
  }

  const isCompleting = form.status === 'completed';
  return (
    <form className="knowledge-form application-form" onSubmit={submit}>
      <label><span>O que você vai colocar em prática?</span><input required maxLength={180} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label>
      <label><span>Como pretende fazer?</span><textarea maxLength={1500} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label>
      <div className="form-grid-two">
        <label><span>Prazo opcional</span><input type="datetime-local" value={form.dueAt} onChange={event => setForm({ ...form, dueAt: event.target.value })} /></label>
        <label><span>Status</span><select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}><option value="planned">Planejada</option><option value="in_progress">Em andamento</option><option value="completed">Concluída</option><option value="dismissed">Descartada</option></select></label>
        {!!paths.length && <label><span>Trilha relacionada</span><select value={form.learningPathId || ''} onChange={event => setForm({ ...form, learningPathId: event.target.value })}><option value="">Sem trilha</option>{paths.map(path => <option key={path.id} value={path.id}>{path.title}</option>)}</select></label>}
      </div>
      {isCompleting && <fieldset className="application-evidence"><legend>Evidência e reflexão final</legend><label><span>O que você fez?</span><textarea maxLength={1500} value={form.evidenceText} onChange={event => setForm({ ...form, evidenceText: event.target.value })} placeholder="Uma descrição curta já é suficiente." /></label><label><span>Link de evidência (opcional)</span><input type="url" maxLength={1000} value={form.evidenceUrl} onChange={event => setForm({ ...form, evidenceUrl: event.target.value })} placeholder="https://..." /></label><label><span>O que funcionou ou não funcionou?</span><textarea maxLength={1500} value={form.reflection} onChange={event => setForm({ ...form, reflection: event.target.value })} /></label><label className="checkbox-row"><input type="checkbox" checked={Boolean(form.reviewAgain)} onChange={event => setForm({ ...form, reviewAgain: event.target.checked })} /><span>Quero revisar novamente os cartões deste conteúdo</span></label><small>Para considerar o conteúdo realmente aplicado, registre ao menos uma evidência ou reflexão.</small></fieldset>}
      <div className="knowledge-form-actions"><button className="primary-btn" disabled={saving}>{saving ? 'Salvando...' : isCompleting ? 'Concluir aplicação' : 'Salvar compromisso'}</button><button className="ghost-btn" type="button" onClick={onCancel}>Cancelar</button></div>
    </form>
  );
}
