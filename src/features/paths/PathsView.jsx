import { useState } from 'react';

const DEFAULT_FORM = {
  title: '', objective: '', description: '', currentLevel: 'iniciante', weeklyMinutes: 90,
  deadline: '', categories: [], resultType: 'aprender', autoOrganize: true
};

export default function PathsView({ paths = [], loading, categories = [], onCreate, onOpen }) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);

  async function submit(event) {
    event.preventDefault();
    const created = await onCreate({ ...form, deadline: form.deadline || null });
    if (created) {
      setForm(DEFAULT_FORM);
      setCreating(false);
    }
  }

  return (
    <section className="view-stack paths-view">
      <div className="paths-hero">
        <div>
          <span className="eyebrow">Trilhas Inteligentes</span>
          <h1>Transforme conteúdos salvos em um caminho para um objetivo real.</h1>
          <p>O Guardei encontra materiais do seu acervo, organiza uma sequência e mostra o que ainda está faltando.</p>
        </div>
        <button className="primary-btn" onClick={() => setCreating(value => !value)}>{creating ? 'Fechar' : 'Criar trilha'}</button>
      </div>

      {creating && (
        <form className="path-create-card" onSubmit={submit}>
          <label><span>Nome da trilha</span><input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="Ex: Construir meu SaaS" required maxLength={140} /></label>
          <label className="wide"><span>Objetivo</span><textarea value={form.objective} onChange={event => setForm({ ...form, objective: event.target.value })} placeholder="Ex: aprender o necessário para publicar uma primeira versão segura" required maxLength={800} /></label>
          <label className="wide"><span>Descrição opcional</span><textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} maxLength={1500} /></label>
          <label><span>Nível atual</span><select value={form.currentLevel} onChange={event => setForm({ ...form, currentLevel: event.target.value })}><option value="iniciante">Iniciante</option><option value="intermediario">Intermediário</option><option value="avancado">Avançado</option></select></label>
          <label><span>Minutos por semana</span><input type="number" min="5" max="10080" value={form.weeklyMinutes} onChange={event => setForm({ ...form, weeklyMinutes: Number(event.target.value) })} /></label>
          <label><span>Prazo opcional</span><input type="date" value={form.deadline} onChange={event => setForm({ ...form, deadline: event.target.value })} /></label>
          <label><span>Resultado esperado</span><select value={form.resultType} onChange={event => setForm({ ...form, resultType: event.target.value })}><option value="aprender">Aprender um assunto</option><option value="construir">Construir algo</option><option value="decidir">Tomar uma decisão</option><option value="revisar">Revisar para uma prova</option><option value="planejar">Planejar uma ação</option></select></label>
          <fieldset className="wide path-category-fieldset"><legend>Categorias de interesse</legend>{categories.map(category => <label key={category.id}><input type="checkbox" checked={form.categories.includes(category.id)} onChange={event => setForm({ ...form, categories: event.target.checked ? [...form.categories, category.id] : form.categories.filter(id => id !== category.id) })} /> {category.label}</label>)}</fieldset>
          <label className="wide path-auto-check"><input type="checkbox" checked={form.autoOrganize} onChange={event => setForm({ ...form, autoOrganize: event.target.checked })} /> Organizar automaticamente com os conteúdos do meu acervo</label>
          <button className="primary-btn" type="submit" disabled={loading}>{loading ? 'Criando e organizando...' : 'Criar trilha'}</button>
        </form>
      )}

      {loading && !creating && <div className="path-loading" aria-live="polite">Carregando suas trilhas...</div>}

      {paths.length ? (
        <div className="paths-grid">
          {paths.map(path => (
            <button key={path.id} className="path-card" type="button" onClick={() => onOpen(path.id)}>
              <span className={`path-status ${path.status}`}>{statusLabel(path.status)}</span>
              <strong>{path.title}</strong>
              <p>{path.objective}</p>
              <div className="path-progress" aria-label={`${Math.round(path.progress * 100)}% concluído`}><span style={{ width: `${Math.round(path.progress * 100)}%` }} /></div>
              <small>{Math.round(path.progress * 100)}% · {path.items?.length || 0} itens · {totalMinutes(path)} min</small>
              {path.gaps?.some(gap => gap.status === 'open') && <em>{path.gaps.filter(gap => gap.status === 'open').length} lacunas para revisar</em>}
            </button>
          ))}
        </div>
      ) : !loading && <div className="path-empty"><strong>Você ainda não criou uma trilha</strong><span>Comece por um objetivo que realmente importa agora.</span><button onClick={() => setCreating(true)}>Criar primeira trilha</button></div>}
    </section>
  );
}

function totalMinutes(path) { return (path.items || []).reduce((total, item) => total + Number(item.estimatedMinutes || 0), 0); }
function statusLabel(status) { return { active: 'Em andamento', completed: 'Concluída', archived: 'Arquivada' }[status] || status; }
