import { useEffect, useState } from 'react';
import { knowledgeService } from '../../services/knowledgeService.js';

const empty = { mainLearning: '', rememberLater: '', applicationIdea: '', confidence: '' };

export default function ReflectionForm({ video, expanded = false, onSkip, onChanged, onNotify }) {
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(expanded);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setOpen(expanded); }, [expanded]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    knowledgeService.reflection(video.id).then(data => {
      if (!active || !data.reflection) return;
      setForm({
        mainLearning: data.reflection.mainLearning || '',
        rememberLater: data.reflection.rememberLater || '',
        applicationIdea: data.reflection.applicationIdea || '',
        confidence: data.reflection.confidence || ''
      });
    }).catch(() => {}).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [video.id]);

  async function save(event) {
    event?.preventDefault();
    setSaving(true);
    try {
      const data = await knowledgeService.saveReflection(video.id, { ...form, confidence: form.confidence ? Number(form.confidence) : null });
      setOpen(false);
      onNotify?.('Aprendizado registrado');
      onChanged?.(data.reflection);
    } catch (error) { onNotify?.(error.message); }
    finally { setSaving(false); }
  }

  function useCapsule() {
    const summary = video.capsule?.summary || video.summary || '';
    setForm(current => ({ ...current, mainLearning: current.mainLearning || summary, rememberLater: current.rememberLater || summary }));
    setOpen(true);
  }

  return (
    <section className={`knowledge-panel reflection-panel ${open ? 'open' : ''}`}>
      <div className="knowledge-panel-head">
        <div><span className="eyebrow">Depois de consumir</span><h3>Registrar aprendizado</h3></div>
        <button type="button" className="ghost-btn" onClick={() => setOpen(value => !value)}>{open ? 'Fechar' : 'Registrar'}</button>
      </div>
      {!open && <p className="knowledge-panel-copy">Uma reflexão curta ajuda a transformar consumo em algo que você consegue lembrar e aplicar.</p>}
      {open && (
        <form className="knowledge-form" onSubmit={save}>
          {loading ? <div className="knowledge-skeleton">Carregando sua reflexão...</div> : <>
            <label><span>Qual foi a principal coisa que você aprendeu?</span><textarea value={form.mainLearning} onChange={event => setForm({ ...form, mainLearning: event.target.value })} maxLength={1000} /></label>
            <label><span>O que você quer lembrar depois?</span><textarea value={form.rememberLater} onChange={event => setForm({ ...form, rememberLater: event.target.value })} maxLength={1000} /></label>
            <label><span>Como isso poderia ser aplicado?</span><textarea value={form.applicationIdea} onChange={event => setForm({ ...form, applicationIdea: event.target.value })} maxLength={1000} /></label>
            <fieldset className="confidence-scale"><legend>Quanto você acha que entendeu?</legend>{[1,2,3,4,5].map(value => <label key={value}><input type="radio" name={`confidence-${video.id}`} value={value} checked={Number(form.confidence) === value} onChange={() => setForm({ ...form, confidence: value })} /><span>{value}<small>{['Muito pouco','Pouco','Razoável','Bem','Muito bem'][value-1]}</small></span></label>)}</fieldset>
            <div className="knowledge-form-actions">
              <button className="primary-btn" disabled={saving}>{saving ? 'Salvando...' : 'Salvar rapidamente'}</button>
              {(video.capsule?.summary || video.summary) && <button type="button" className="secondary-btn" onClick={useCapsule}>Usar sugestão da cápsula</button>}
              <button type="button" className="ghost-btn" onClick={() => { setOpen(false); onSkip?.(); }}>Pular por agora</button>
            </div>
          </>}
        </form>
      )}
    </section>
  );
}
