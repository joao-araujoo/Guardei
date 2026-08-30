import { useEffect, useRef, useState } from 'react';
import SearchResultReason from './SearchResultReason.jsx';

const RECENT_KEY = 'guardei.smart-search.recent.v1';
const SUGGESTIONS = [
  'conteúdos para melhorar a autenticação do meu sistema',
  'ideias de interface simples para aplicativo mobile',
  'coisas rápidas para aprender durante o almoço',
  'conteúdos sobre como vender um SaaS',
  'vídeos leves para quando eu estiver cansado'
];
const DEFAULT_FILTERS = { category: 'all', status: 'all', platform: 'all', mood: 'all', duration: 'all', priority: 'all', hasCapsule: 'all' };

export default function SmartSearch({ categories = [], platforms = [], onSearch, results = [], loading = false, meta = {}, onOpenItem, onClear }) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [mode, setMode] = useState('hybrid');
  const [recent, setRecent] = useState(() => readRecent());
  const inputRef = useRef(null);

  useEffect(() => {
    function focusSearch(event) {
      if (event.key !== '/' || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener('keydown', focusSearch);
    return () => document.removeEventListener('keydown', focusSearch);
  }, []);

  async function submit(event, suggestedQuery) {
    event?.preventDefault();
    const finalQuery = String(suggestedQuery ?? query).trim();
    if (!finalQuery && Object.values(filters).every(value => value === 'all')) {
      onClear?.();
      return;
    }
    if (suggestedQuery) setQuery(suggestedQuery);
    await onSearch({ q: finalQuery, mode, ...normalizeFilters(filters), limit: 30, offset: 0 });
    if (finalQuery) {
      const next = [finalQuery, ...recent.filter(item => item !== finalQuery)].slice(0, 6);
      setRecent(next);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    }
  }

  function clearAll() {
    setQuery('');
    setFilters(DEFAULT_FILTERS);
    onClear?.();
    inputRef.current?.focus();
  }

  return (
    <section className="smart-search" aria-labelledby="smart-search-title">
      <form onSubmit={submit} className="smart-search-main">
        <label htmlFor="smart-search-input" id="smart-search-title">Busca inteligente</label>
        <div className="smart-search-row">
          <input
            ref={inputRef}
            id="smart-search-input"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Ex: conteúdos para melhorar a autenticação do meu sistema"
            aria-describedby="smart-search-hint"
          />
          <button className="primary-btn-small" type="submit" disabled={loading}>{loading ? 'Buscando...' : 'Buscar'}</button>
          <button type="button" className="secondary-btn" onClick={clearAll}>Limpar</button>
        </div>
        <small id="smart-search-hint">Use linguagem natural. Atalho: pressione / para focar a busca.</small>
      </form>

      <div className="search-mode-switch" role="group" aria-label="Modo de busca">
        <button type="button" className={mode === 'hybrid' ? 'active' : ''} onClick={() => setMode('hybrid')}>Inteligente</button>
        <button type="button" className={mode === 'text' ? 'active' : ''} onClick={() => setMode('text')}>Somente texto</button>
      </div>

      <details className="advanced-search-filters">
        <summary>Filtros avançados</summary>
        <div className="advanced-filter-grid">
          <SearchSelect label="Categoria" value={filters.category} onChange={value => setFilters({ ...filters, category: value })} options={[['all', 'Todas'], ...categories.map(item => [item.id, item.label])]} />
          <SearchSelect label="Status" value={filters.status} onChange={value => setFilters({ ...filters, status: value })} options={STATUS_OPTIONS} />
          <SearchSelect label="Fonte" value={filters.platform} onChange={value => setFilters({ ...filters, platform: value })} options={[['all', 'Todas'], ...platforms.map(item => [item.id, item.label])]} />
          <SearchSelect label="Humor" value={filters.mood} onChange={value => setFilters({ ...filters, mood: value })} options={MOOD_OPTIONS} />
          <SearchSelect label="Duração" value={filters.duration} onChange={value => setFilters({ ...filters, duration: value })} options={DURATION_OPTIONS} />
          <SearchSelect label="Prioridade" value={filters.priority} onChange={value => setFilters({ ...filters, priority: value })} options={PRIORITY_OPTIONS} />
          <SearchSelect label="Cápsula" value={filters.hasCapsule} onChange={value => setFilters({ ...filters, hasCapsule: value })} options={CAPSULE_OPTIONS} />
        </div>
      </details>

      <div className="search-suggestions" aria-label="Sugestões e buscas recentes">
        {[...recent.map(text => ({ text, recent: true })), ...SUGGESTIONS.slice(0, 4).map(text => ({ text }))].slice(0, 8).map(item => (
          <button key={`${item.recent ? 'recent' : 'suggestion'}-${item.text}`} type="button" onClick={event => submit(event, item.text)}>
            {item.recent ? '↺ ' : '✦ '}{item.text}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="search-status">
        {loading ? 'Combinando texto, cápsulas e similaridade semântica.' : meta.query ? `${meta.total || 0} correspondências · ${meta.mode === 'textual_fallback' ? 'fallback textual ativo' : 'ranking híbrido'}` : ''}
      </div>

      {results.length > 0 && (
        <div className="smart-search-results">
          {results.map(result => (
            <button key={result.item.id} type="button" className="smart-search-result" onClick={() => onOpenItem(result.item.id)}>
              <span className="search-result-copy">
                <strong>{result.item.titleCustom || result.item.titleAi || result.item.titleOriginal || 'Item salvo'}</strong>
                <small>{result.highlights?.[0]?.text || result.item.note || result.item.capsule?.summary || 'Sem trecho disponível.'}</small>
              </span>
              <SearchResultReason reasons={result.reasons} score={result.score} mode={meta.mode} />
            </button>
          ))}
        </div>
      )}

      {!loading && meta.query && results.length === 0 && (
        <div className="search-empty-state">
          <strong>Nenhuma correspondência relevante</strong>
          <span>Tente descrever o objetivo com outras palavras, remover filtros ou voltar à busca textual simples.</span>
          <button type="button" onClick={() => setMode('text')}>Usar busca textual</button>
        </div>
      )}
    </section>
  );
}

function SearchSelect({ label, value, onChange, options }) {
  return <label><span>{label}</span><select value={value} onChange={event => onChange(event.target.value)}>{options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label>;
}
function normalizeFilters(filters) {
  const output = { ...filters };
  if (output.hasCapsule === 'yes') output.hasCapsule = true;
  else if (output.hasCapsule === 'no') output.hasCapsule = false;
  else delete output.hasCapsule;
  return output;
}
function readRecent() {
  try { const value = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(value) ? value.slice(0, 6) : []; } catch { return []; }
}
const STATUS_OPTIONS = [['all', 'Todos'], ['inbox', 'Inbox'], ['novo', 'Novo'], ['rever', 'Rever'], ['importante', 'Importante'], ['aplicado', 'Aplicado'], ['arquivado', 'Arquivado']];
const MOOD_OPTIONS = [['all', 'Qualquer'], ['leve', 'Leve'], ['neutro', 'Neutro'], ['focado', 'Focado'], ['criativo', 'Criativo']];
const DURATION_OPTIONS = [['all', 'Qualquer'], ['short', 'Curto'], ['medium', 'Médio'], ['long', 'Longo'], ['unknown', 'Incerto']];
const PRIORITY_OPTIONS = [['all', 'Qualquer'], ['baixa', 'Baixa'], ['media', 'Média'], ['alta', 'Alta']];
const CAPSULE_OPTIONS = [['all', 'Qualquer'], ['yes', 'Com cápsula'], ['no', 'Sem cápsula']];
