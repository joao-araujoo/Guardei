export default function SearchResultReason({ reasons = [], score, mode }) {
  return (
    <div className="search-result-reasons" aria-label="Motivos da correspondência">
      {reasons.slice(0, 3).map(reason => <span key={reason}>{reason}</span>)}
      {Number.isFinite(score) && <small>{mode === 'textual_fallback' ? 'Busca textual' : 'Busca híbrida'} · {Math.round(score * 100)}%</small>}
    </div>
  );
}
