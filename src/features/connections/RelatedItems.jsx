import { useEffect, useState } from 'react';
import { getRelatedItems } from '../../services/connectionService.js';

export default function RelatedItems({ videoId, onOpenItem }) {
  const [state, setState] = useState({ loading: true, items: [], error: '' });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, items: [], error: '' });
    getRelatedItems(videoId, 6)
      .then(data => !cancelled && setState({ loading: false, items: data.items || [], error: '' }))
      .catch(() => !cancelled && setState({ loading: false, items: [], error: 'Não foi possível carregar os relacionados.' }));
    return () => { cancelled = true; };
  }, [videoId]);

  return (
    <section className="related-items" aria-labelledby="related-items-title">
      <div className="related-items-head"><span className="eyebrow">Conexões</span><h3 id="related-items-title">Relacionados no seu acervo</h3></div>
      <div aria-live="polite">
        {state.loading && <div className="related-loading">Calculando proximidade semântica...</div>}
        {state.error && <div className="related-error">{state.error}</div>}
      </div>
      {!state.loading && !state.error && state.items.length === 0 && <p className="related-empty">Ainda não há itens suficientemente próximos para mostrar.</p>}
      {state.items.length > 0 && (
        <div className="related-list">
          {state.items.map(entry => (
            <button key={entry.item.id} type="button" onClick={() => onOpenItem(entry.item.id)}>
              <span><strong>{entry.item.titleCustom || entry.item.titleAi || entry.item.titleOriginal || 'Item salvo'}</strong><small>{entry.reason}</small></span>
              <em>{Math.round(entry.score * 100)}%</em>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
