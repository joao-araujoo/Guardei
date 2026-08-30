import { useMemo, useState } from 'react';

export default function PathEditor({ path, videos = [], onSave, onAddItem, onClose }) {
  const [draft, setDraft] = useState({
    title: path.title, objective: path.objective, description: path.description || '', currentLevel: path.currentLevel,
    weeklyMinutes: path.weeklyMinutes, deadline: path.deadline?.slice?.(0, 10) || '', resultType: path.resultType || ''
  });
  const [videoId, setVideoId] = useState('');
  const available = useMemo(() => videos.filter(video => !(path.items || []).some(item => item.videoId === video.id)), [videos, path.items]);

  async function save(event) {
    event.preventDefault();
    await onSave({ ...draft, deadline: draft.deadline || null });
    onClose();
  }

  async function add() {
    if (!videoId) return;
    await onAddItem({ videoId, section: 'Adicionados por você' });
    setVideoId('');
  }

  return (
    <div className="path-editor-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="path-editor" role="dialog" aria-modal="true" aria-labelledby="path-editor-title">
        <button className="modal-close" onClick={onClose} aria-label="Fechar editor">×</button>
        <h2 id="path-editor-title">Editar trilha</h2>
        <form onSubmit={save}>
          <label><span>Nome</span><input value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} required /></label>
          <label><span>Objetivo</span><textarea value={draft.objective} onChange={event => setDraft({ ...draft, objective: event.target.value })} required /></label>
          <label><span>Descrição</span><textarea value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label>
          <div className="path-editor-grid">
            <label><span>Nível</span><select value={draft.currentLevel} onChange={event => setDraft({ ...draft, currentLevel: event.target.value })}><option value="iniciante">Iniciante</option><option value="intermediario">Intermediário</option><option value="avancado">Avançado</option></select></label>
            <label><span>Minutos por semana</span><input type="number" min="5" value={draft.weeklyMinutes} onChange={event => setDraft({ ...draft, weeklyMinutes: Number(event.target.value) })} /></label>
            <label><span>Prazo</span><input type="date" value={draft.deadline} onChange={event => setDraft({ ...draft, deadline: event.target.value })} /></label>
          </div>
          <button className="primary-btn" type="submit">Salvar alterações</button>
        </form>
        <div className="path-add-item">
          <h3>Adicionar conteúdo manualmente</h3>
          <select value={videoId} onChange={event => setVideoId(event.target.value)} aria-label="Conteúdo para adicionar"><option value="">Escolha um item do acervo</option>{available.map(video => <option key={video.id} value={video.id}>{video.titleCustom || video.titleAi || video.titleOriginal || 'Item salvo'}</option>)}</select>
          <button type="button" onClick={add} disabled={!videoId}>Adicionar à trilha</button>
        </div>
      </section>
    </div>
  );
}
