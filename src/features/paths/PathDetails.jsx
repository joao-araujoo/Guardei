import { useMemo, useState } from 'react';
import PathEditor from './PathEditor.jsx';

export default function PathDetails({ path, videos, loading, onBack, onOpenVideo, onUpdate, onUpdateItem, onRemoveItem, onReorder, onReorganize, onDuplicate, onDelete, onAddItem, onUpdateGap, onTalk }) {
  const [editing, setEditing] = useState(false);
  const [draggedId, setDraggedId] = useState(null);
  const sections = useMemo(() => groupBySection(path.items || []), [path.items]);
  const sectionNames = useMemo(() => [...sections.keys()], [sections]);
  const nextItem = (path.items || []).find(item => !['completed', 'skipped'].includes(item.status));
  const totalMinutes = (path.items || []).reduce((sum, item) => sum + Number(item.estimatedMinutes || 0), 0);

  async function move(itemId, direction) {
    const items = [...(path.items || [])];
    const index = items.findIndex(item => item.id === itemId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    await onReorder(items.map(item => ({ id: item.id, section: item.section })));
  }

  async function dropBefore(targetId) {
    if (!draggedId || draggedId === targetId) return;
    const items = [...(path.items || [])];
    const from = items.findIndex(item => item.id === draggedId);
    const to = items.findIndex(item => item.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    setDraggedId(null);
    await onReorder(items.map(item => ({ id: item.id, section: item.section })));
  }

  async function renameSection(section) {
    const nextName = window.prompt('Novo nome da etapa:', section)?.trim();
    if (!nextName || nextName === section) return;
    await onReorder((path.items || []).map(item => ({ id: item.id, section: item.section === section ? nextName : item.section })));
  }

  async function moveToSection(item, value) {
    let section = value;
    if (value === '__new__') section = window.prompt('Nome da nova etapa:', 'Nova etapa')?.trim();
    if (!section || section === item.section) return;
    await onUpdateItem(item.id, { section });
  }

  async function editNote(item) {
    const note = window.prompt('Observação deste item na trilha:', item.note || '');
    if (note === null) return;
    await onUpdateItem(item.id, { note });
  }

  return (
    <section className="view-stack path-details-view">
      <button className="back-link" onClick={onBack}>← Voltar para trilhas</button>
      <header className="path-detail-header">
        <div>
          <span className="eyebrow">Trilha Inteligente</span>
          <h1>{path.title}</h1>
          <p>{path.objective}</p>
        </div>
        <div className="path-header-actions">
          <button onClick={() => setEditing(true)}>Editar</button>
          <button onClick={onReorganize} disabled={loading}>{loading ? 'Reorganizando...' : 'Reorganizar'}</button>
          <button onClick={onTalk}>Conversar com Guardinho</button>
        </div>
      </header>

      <div className="path-summary-grid">
        <article><span>Progresso</span><strong>{Math.round(path.progress * 100)}%</strong><div className="path-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(path.progress * 100)}><span style={{ width: `${Math.round(path.progress * 100)}%` }} /></div></article>
        <article><span>Tempo estimado</span><strong>{totalMinutes} min</strong><small>{path.weeklyMinutes} min disponíveis por semana</small></article>
        <article><span>Próxima ação</span><strong>{nextItem ? (nextItem.video.titleCustom || nextItem.video.titleAi || nextItem.video.titleOriginal) : 'Trilha concluída'}</strong><small>{nextItem?.reason || 'Todos os itens foram processados.'}</small></article>
      </div>

      <p className="path-reorder-help">Arraste os itens para reorganizar ou use os botões “Mover para cima” e “Mover para baixo”.</p>
      <div className="path-stage-list">
        {[...sections.entries()].map(([section, items], sectionIndex) => (
          <section key={section} className="path-stage" aria-labelledby={`path-stage-${sectionIndex}`}>
            <div className="path-stage-head">
              <span>{sectionIndex + 1}</span>
              <h2 id={`path-stage-${sectionIndex}`}>{section}</h2>
              <button type="button" onClick={() => renameSection(section)} aria-label={`Renomear etapa ${section}`}>Renomear</button>
            </div>
            <div className="path-stage-items">
              {items.map(item => (
                <article
                  key={item.id}
                  className={`path-item ${item.status}${draggedId === item.id ? ' dragging' : ''}`}
                  draggable
                  onDragStart={() => setDraggedId(item.id)}
                  onDragEnd={() => setDraggedId(null)}
                  onDragOver={event => event.preventDefault()}
                  onDrop={() => dropBefore(item.id)}
                >
                  <button className="path-item-main" onClick={() => onOpenVideo(item.videoId)}>
                    <strong>{item.video.titleCustom || item.video.titleAi || item.video.titleOriginal || 'Item salvo'}</strong>
                    <span>{item.reason || 'Selecionado para esta etapa.'}</span>
                    {item.note && <em>Observação: {item.note}</em>}
                    <small>{item.estimatedMinutes} min · {statusLabel(item.status)}</small>
                  </button>
                  <div className="path-item-controls" aria-label="Ações do item">
                    <button onClick={() => onUpdateItem(item.id, { status: item.status === 'completed' ? 'pending' : 'completed' })}>{item.status === 'completed' ? 'Desmarcar' : 'Concluir'}</button>
                    <button onClick={() => move(item.id, -1)} aria-label="Mover item para cima">↑</button>
                    <button onClick={() => move(item.id, 1)} aria-label="Mover item para baixo">↓</button>
                    <label className="path-section-select"><span className="sr-only">Mover para outra etapa</span><select value={item.section} onChange={event => moveToSection(item, event.target.value)}><option value={item.section}>{item.section}</option>{sectionNames.filter(name => name !== item.section).map(name => <option key={name} value={name}>{name}</option>)}<option value="__new__">+ Criar nova etapa</option></select></label>
                    <button onClick={() => editNote(item)}>Observação</button>
                    <button onClick={() => onRemoveItem(item.id)} aria-label="Remover item da trilha">Remover</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="path-gaps" aria-labelledby="path-gaps-title">
        <div className="path-gaps-head"><div><span className="eyebrow">O que está faltando</span><h2 id="path-gaps-title">Lacunas identificadas</h2></div></div>
        {(path.gaps || []).filter(gap => gap.status === 'open').length ? (
          <div className="path-gap-list">
            {path.gaps.filter(gap => gap.status === 'open').map(gap => (
              <article key={gap.id} className={`path-gap importance-${gap.importance}`}>
                <strong>{gap.title}</strong><p>{gap.description}</p>
                <div><button onClick={() => onUpdateGap(gap.id, { status: 'resolved' })}>Marcar como resolvida</button><button onClick={() => onUpdateGap(gap.id, { status: 'dismissed' })}>Dispensar</button></div>
              </article>
            ))}
          </div>
        ) : <div className="path-empty compact"><strong>Nenhuma lacuna aberta</strong><span>A trilha possui uma cobertura equilibrada no momento.</span></div>}
      </section>

      <div className="path-danger-actions">
        <button onClick={onDuplicate}>Duplicar trilha</button>
        <button onClick={() => onUpdate({ status: path.status === 'archived' ? 'active' : 'archived' })}>{path.status === 'archived' ? 'Reativar' : 'Arquivar'}</button>
        <button className="danger" onClick={() => window.confirm('Excluir esta trilha permanentemente?') && onDelete()}>Excluir trilha</button>
      </div>

      {editing && <PathEditor path={path} videos={videos} onSave={onUpdate} onAddItem={onAddItem} onClose={() => setEditing(false)} />}
    </section>
  );
}

function groupBySection(items) { const map = new Map(); items.forEach(item => { if (!map.has(item.section)) map.set(item.section, []); map.get(item.section).push(item); }); return map; }
function statusLabel(status) { return { pending: 'Pendente', in_progress: 'Em andamento', completed: 'Concluído', skipped: 'Ignorado' }[status] || status; }
