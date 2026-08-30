import { useEffect, useMemo, useState } from 'react';
import { getKnowledgeMap } from '../../services/connectionService.js';

export default function KnowledgeMap({ categories = [], paths = [], onOpenItem }) {
  const [mode, setMode] = useState('map');
  const [filters, setFilters] = useState({ category: 'all', status: 'all', pathId: 'all' });
  const [state, setState] = useState({ loading: true, nodes: [], edges: [], error: '', truncated: false });

  useEffect(() => {
    let cancelled = false;
    setState(current => ({ ...current, loading: true, error: '' }));
    getKnowledgeMap({ ...filters, limit: 60 })
      .then(data => !cancelled && setState({ loading: false, nodes: data.nodes || [], edges: data.edges || [], error: '', truncated: data.truncated }))
      .catch(() => !cancelled && setState({ loading: false, nodes: [], edges: [], error: 'Não foi possível montar o mapa.' }));
    return () => { cancelled = true; };
  }, [filters.category, filters.status, filters.pathId]);

  const groups = useMemo(() => groupNodes(state.nodes), [state.nodes]);
  const neighbors = useMemo(() => buildNeighborMap(state.edges), [state.edges]);

  return (
    <section className="view-stack knowledge-map-view">
      <header className="knowledge-map-header">
        <div><span className="eyebrow">Mapa de conhecimento</span><h1>Veja como seus conteúdos se conectam.</h1><p>As relações usam similaridade calculada e conceitos compartilhados. A lista abaixo oferece a mesma informação sem depender do gráfico.</p></div>
        <div className="map-mode-switch" role="group" aria-label="Visualização do mapa"><button className={mode === 'map' ? 'active' : ''} onClick={() => setMode('map')}>Mapa</button><button className={mode === 'list' ? 'active' : ''} onClick={() => setMode('list')}>Lista acessível</button></div>
      </header>

      <div className="map-filters">
        <label><span>Categoria</span><select value={filters.category} onChange={event => setFilters({ ...filters, category: event.target.value })}><option value="all">Todas</option>{categories.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label><span>Status</span><select value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })}><option value="all">Todos</option><option value="novo">Novo</option><option value="rever">Rever</option><option value="importante">Importante</option><option value="aplicado">Aplicado</option><option value="arquivado">Arquivado</option></select></label>
        <label><span>Trilha</span><select value={filters.pathId} onChange={event => setFilters({ ...filters, pathId: event.target.value })}><option value="all">Todas</option>{paths.map(path => <option key={path.id} value={path.id}>{path.title}</option>)}</select></label>
      </div>

      <div className="map-status" aria-live="polite">{state.loading ? 'Agrupando conteúdos e calculando relações...' : state.error || `${state.nodes.length} conteúdos e ${state.edges.length} relações${state.truncated ? ' · visualização limitada aos mais recentes' : ''}.`}</div>

      {!state.loading && !state.error && state.nodes.length === 0 && <div className="path-empty"><strong>Nenhum conteúdo para mapear</strong><span>Remova filtros ou salve novos materiais.</span></div>}

      {mode === 'map' && state.nodes.length > 0 && (
        <div className="knowledge-cluster-grid" role="list" aria-label="Grupos de conteúdos semanticamente relacionados">
          {[...groups.entries()].map(([group, nodes]) => (
            <section key={group} className="knowledge-cluster" role="listitem">
              <h2>{group}</h2>
              <div>
                {nodes.map(node => (
                  <button key={node.id} type="button" className="knowledge-node" onClick={() => onOpenItem(node.id)} aria-label={`${node.label}. ${neighbors.get(node.id)?.length || 0} conexões.`}>
                    <strong>{node.label}</strong><small>{node.concepts?.slice(0, 2).join(' · ') || node.category}</small><em>{neighbors.get(node.id)?.length || 0} conexões</em>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {mode === 'list' && state.nodes.length > 0 && (
        <div className="knowledge-list-view">
          {state.nodes.map(node => (
            <article key={node.id}>
              <button onClick={() => onOpenItem(node.id)}><strong>{node.label}</strong><small>{node.category} · {node.status}</small></button>
              <ul>{(neighbors.get(node.id) || []).slice(0, 6).map(edge => { const other = state.nodes.find(item => item.id === (edge.source === node.id ? edge.target : edge.source)); return <li key={edge.id}><span>{other?.label || 'Conteúdo relacionado'}</span><small>{edge.reason}</small></li>; })}</ul>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function groupNodes(nodes) {
  const groups = new Map();
  nodes.forEach(node => { const key = node.concepts?.[0] || node.category || 'Outros'; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(node); });
  return groups;
}
function buildNeighborMap(edges) { const map = new Map(); edges.forEach(edge => { if (!map.has(edge.source)) map.set(edge.source, []); if (!map.has(edge.target)) map.set(edge.target, []); map.get(edge.source).push(edge); map.get(edge.target).push(edge); }); return map; }
