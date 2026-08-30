import { useEffect, useState } from 'react';
import CardEditor from './CardEditor.jsx';
import { knowledgeService } from '../../services/knowledgeService.js';

export default function KnowledgeCardPanel({ videoId, onChanged, onNotify }) {
  const [cards, setCards] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [manual, setManual] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => { load(); }, [videoId]);
  async function load() {
    setLoading(true);
    try { const data = await knowledgeService.cards({ videoId, limit: 30 }); setCards(data.cards || []); }
    catch (error) { onNotify?.(error.message); }
    finally { setLoading(false); }
  }
  async function generate() {
    setGenerating(true);
    try { const data = await knowledgeService.generateCards(videoId, 3); setSuggestions(data.suggestions || []); if (!data.suggestions?.length) onNotify?.('Ainda não há base suficiente para sugerir cartões úteis'); }
    catch (error) { onNotify?.(error.message); }
    finally { setGenerating(false); }
  }
  async function create(draft, sourceType = 'manual') {
    try { const data = await knowledgeService.createCard({ videoId, ...draft, sourceType }); setCards(current => [data.card, ...current]); setManual(false); onChanged?.(); onNotify?.('Cartão salvo'); }
    catch (error) { onNotify?.(error.message); }
  }
  async function update(id, draft) {
    try { const data = await knowledgeService.updateCard(id, draft); setCards(current => current.map(card => card.id === id ? data.card : card)); setEditingId(null); onChanged?.(); }
    catch (error) { onNotify?.(error.message); }
  }
  async function toggle(card) {
    const next = card.status === 'active' ? 'suspended' : 'active';
    if (next === 'suspended' && !window.confirm('Suspender este cartão? Ele deixará de aparecer nas revisões.')) return;
    await update(card.id, { status: next });
  }
  async function remove(card) {
    if (!window.confirm('Excluir este cartão e seu histórico de tentativas?')) return;
    try { await knowledgeService.deleteCard(card.id); setCards(current => current.filter(item => item.id !== card.id)); onChanged?.(); }
    catch (error) { onNotify?.(error.message); }
  }

  return (
    <section className="knowledge-panel">
      <div className="knowledge-panel-head"><div><span className="eyebrow">Recordação ativa</span><h3>Cartões de memória</h3></div><div className="inline-actions"><button className="ghost-btn" type="button" onClick={() => setManual(value => !value)}>Criar manual</button><button className="secondary-btn" type="button" disabled={generating} onClick={generate}>{generating ? 'Sugerindo...' : 'Sugerir até 3'}</button></div></div>
      <p className="knowledge-panel-copy">A IA apenas sugere. Você revisa, edita e aceita cada cartão antes de salvar.</p>
      {manual && <CardEditor card={{}} onSave={draft => create(draft, 'manual')} onReject={() => setManual(false)} />}
      {!!suggestions.length && <div className="card-suggestions"><h4>Sugestões para revisar</h4>{suggestions.map((card, index) => <CardEditor key={`${card.question}-${index}`} card={card} label="Aceitar cartão" onSave={draft => { create(draft, card.sourceType || 'ai'); setSuggestions(current => current.filter((_, itemIndex) => itemIndex !== index)); }} onReject={() => setSuggestions(current => current.filter((_, itemIndex) => itemIndex !== index))} />)}</div>}
      {loading ? <div className="knowledge-skeleton">Carregando cartões...</div> : cards.length ? <div className="saved-card-list">{cards.map(card => editingId === card.id ? <CardEditor key={card.id} card={card} label="Salvar alterações" onSave={draft => update(card.id, draft)} onReject={() => setEditingId(null)} /> : <article key={card.id} className={`saved-card ${card.status}`}><div><strong>{card.question}</strong><small>{card.cardType.replaceAll('_',' ')} · próxima revisão {formatDate(card.nextReviewAt)}</small></div><div className="inline-actions"><button type="button" className="ghost-btn" onClick={() => setEditingId(card.id)}>Editar</button><button type="button" className="ghost-btn" onClick={() => toggle(card)}>{card.status === 'active' ? 'Suspender' : 'Reativar'}</button><button type="button" className="ghost-btn danger-text" onClick={() => remove(card)}>Excluir</button></div></article>)}</div> : <div className="knowledge-empty">Nenhum cartão salvo. Crie apenas os que realmente valem lembrar.</div>}
    </section>
  );
}
function formatDate(value) { if (!value) return 'não definida'; return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(value)); }
