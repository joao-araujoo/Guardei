import { useEffect, useMemo, useRef, useState } from 'react';
import CardEditor from './CardEditor.jsx';
import { knowledgeService } from '../../services/knowledgeService.js';

const RATINGS = [
  { id: 'again', label: 'Não lembrei', help: 'Voltar em breve', shortcut: '1' },
  { id: 'hard', label: 'Difícil', help: 'Intervalo menor', shortcut: '2' },
  { id: 'good', label: 'Bom', help: 'Intervalo normal', shortcut: '3' },
  { id: 'easy', label: 'Fácil', help: 'Intervalo maior', shortcut: '4' }
];

export default function CardReviewSession({ initialCards = [], minutes = 5, onClose, onOpenVideo, onChanged, onNotify }) {
  const [cards, setCards] = useState(initialCards);
  const [loading, setLoading] = useState(!initialCards.length);
  const [index, setIndex] = useState(0);
  const [answerText, setAnswerText] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [lastSchedule, setLastSchedule] = useState(null);
  const [error, setError] = useState('');
  const questionRef = useRef(null);

  useEffect(() => {
    if (initialCards.length) {
      setCards(initialCards);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    knowledgeService.session(minutes).then(data => {
      if (!active) return;
      const sessionCards = (data.session?.activities || []).filter(activity => activity.type === 'card').map(activity => activity.item);
      setCards(sessionCards);
    }).catch(fetchError => active && setError(fetchError.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [initialCards, minutes]);

  const card = cards[index] || null;
  const progress = cards.length ? Math.round((index / cards.length) * 100) : 0;
  const sourceLabel = useMemo(() => ({ manual: 'Criado por você', capsule: 'Cápsula', reflection: 'Reflexão', ai: 'Sugestão revisada' }[card?.sourceType] || 'Conteúdo salvo'), [card?.sourceType]);

  useEffect(() => {
    const stored = card?.id ? window.sessionStorage.getItem(`guardei-review-draft:${card.id}`) || '' : '';
    setAnswerText(stored);
    setRevealed(false);
    setEditing(false);
    setError('');
    questionRef.current?.focus();
  }, [index, card?.id]);

  useEffect(() => {
    if (!card?.id) return;
    if (answerText) window.sessionStorage.setItem(`guardei-review-draft:${card.id}`, answerText);
    else window.sessionStorage.removeItem(`guardei-review-draft:${card.id}`);
  }, [card?.id, answerText]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') { onClose?.(); return; }
      if (!card || saving || editing) return;
      if (!revealed && event.key === ' ' && document.activeElement?.tagName !== 'TEXTAREA') {
        event.preventDefault();
        setRevealed(true);
      }
      if (revealed) {
        const rating = RATINGS.find(item => item.shortcut === event.key);
        if (rating) {
          event.preventDefault();
          review(rating.id);
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [card, revealed, saving, editing, answerText]);

  async function review(rating) {
    if (!card || saving) return;
    setSaving(true);
    setError('');
    try {
      const data = await knowledgeService.reviewCard(card.id, { rating, answerText });
      window.sessionStorage.removeItem(`guardei-review-draft:${card.id}`);
      setLastSchedule(data.schedule);
      onChanged?.(data);
      if (index + 1 < cards.length) setIndex(value => value + 1);
      else setIndex(cards.length);
    } catch (reviewError) {
      setError(reviewError.message);
      onNotify?.(reviewError.message);
      // answerText intentionally remains untouched after a network error.
    } finally { setSaving(false); }
  }

  async function updateCard(draft) {
    try {
      const data = await knowledgeService.updateCard(card.id, draft);
      setCards(current => current.map(item => item.id === card.id ? data.card : item));
      setEditing(false);
      onChanged?.();
    } catch (updateError) { setError(updateError.message); }
  }

  async function suspend() {
    if (!window.confirm('Suspender este cartão? Ele deixará de aparecer nas revisões.')) return;
    try {
      await knowledgeService.updateCard(card.id, { status: 'suspended' });
      setCards(current => current.filter(item => item.id !== card.id));
      if (index >= cards.length - 1) setIndex(Math.max(0, cards.length - 1));
      onChanged?.();
    } catch (suspendError) { setError(suspendError.message); }
  }

  async function remove() {
    if (!window.confirm('Excluir este cartão e todo o histórico dele?')) return;
    try {
      await knowledgeService.deleteCard(card.id);
      setCards(current => current.filter(item => item.id !== card.id));
      if (index >= cards.length - 1) setIndex(Math.max(0, cards.length - 1));
      onChanged?.();
    } catch (deleteError) { setError(deleteError.message); }
  }

  if (loading) return <section className="card-review-session"><div className="knowledge-skeleton">Montando sua sessão...</div></section>;
  if (!card) {
    return (
      <section className="card-review-session review-complete" aria-live="polite">
        <span className="review-complete-icon" aria-hidden="true">✓</span>
        <h2>{cards.length ? 'Sessão concluída' : 'Nenhum cartão pendente'}</h2>
        <p>{lastSchedule ? `A última recordação volta em ${lastSchedule.nextInterval} dia(s).` : 'Quando houver algo para recordar, ele aparecerá aqui.'}</p>
        <button className="primary-btn" type="button" onClick={onClose}>Voltar para Hoje</button>
      </section>
    );
  }

  return (
    <section className="card-review-session" aria-labelledby="review-session-title">
      <header className="card-review-head">
        <div>
          <span className="eyebrow">Recordação ativa</span>
          <h2 id="review-session-title">Cartão {index + 1} de {cards.length}</h2>
        </div>
        <button className="ghost-btn" type="button" onClick={onClose}>Sair da sessão</button>
      </header>
      <div className="review-progress" aria-label={`${index + 1} de ${cards.length} cartões`}><span style={{ width: `${progress}%` }} /></div>

      <article className="active-card" aria-live="polite">
        <div className="active-card-meta">
          <span>{sourceLabel}</span>
          {card.video?.title && <button type="button" className="link-button" onClick={() => onOpenVideo?.(card.video.id)}>Abrir origem: {card.video.title}</button>}
        </div>
        <h3 ref={questionRef} tabIndex="-1">{card.question}</h3>
        {card.hint && <details className="card-hint"><summary>Ver dica</summary><p>{card.hint}</p></details>}

        {!editing && <label className="review-answer-field"><span>Escreva com suas palavras (opcional)</span><textarea value={answerText} onChange={event => setAnswerText(event.target.value)} maxLength={2000} placeholder="Sua resposta fica salva apenas no histórico da sua conta." /></label>}

        {!revealed && !editing && <button className="primary-btn reveal-answer" type="button" onClick={() => setRevealed(true)}>Mostrar resposta</button>}

        {revealed && !editing && (
          <div className="revealed-answer">
            <span className="eyebrow">Resposta de referência</span>
            <p>{card.answer}</p>
            <fieldset className="rating-grid" disabled={saving}>
              <legend>Como foi lembrar?</legend>
              {RATINGS.map(rating => <button key={rating.id} type="button" onClick={() => review(rating.id)}><strong>{rating.label}</strong><small>{rating.help} · tecla {rating.shortcut}</small></button>)}
            </fieldset>
          </div>
        )}

        {editing && <CardEditor card={card} label="Salvar cartão" onSave={updateCard} onReject={() => setEditing(false)} />}
        {error && <p className="form-error" role="alert">{error} Sua resposta digitada foi preservada.</p>}

        <footer className="card-review-tools">
          <button className="ghost-btn" type="button" onClick={() => setEditing(value => !value)}>{editing ? 'Cancelar edição' : 'Editar cartão'}</button>
          <button className="ghost-btn" type="button" onClick={suspend}>Suspender</button>
          <button className="ghost-btn danger-text" type="button" onClick={remove}>Excluir</button>
        </footer>
      </article>
    </section>
  );
}
