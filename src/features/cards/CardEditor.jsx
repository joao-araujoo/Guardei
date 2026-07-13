import { useState } from 'react';

export default function CardEditor({ card, onSave, onReject, saving = false, label = 'Salvar cartão' }) {
  const [draft, setDraft] = useState({ question: card.question || '', answer: card.answer || '', hint: card.hint || '', cardType: card.cardType || 'question_answer' });
  return (
    <article className="card-editor">
      <label><span>Pergunta</span><textarea value={draft.question} maxLength={500} onChange={event => setDraft({ ...draft, question: event.target.value })} /></label>
      <label><span>Resposta esperada</span><textarea value={draft.answer} maxLength={1500} onChange={event => setDraft({ ...draft, answer: event.target.value })} /></label>
      <div className="card-editor-row">
        <label><span>Dica opcional</span><input value={draft.hint} maxLength={400} onChange={event => setDraft({ ...draft, hint: event.target.value })} /></label>
        <label><span>Tipo</span><select value={draft.cardType} onChange={event => setDraft({ ...draft, cardType: event.target.value })}><option value="question_answer">Pergunta e resposta</option><option value="concept_explanation">Conceito</option><option value="situation_application">Situação e aplicação</option><option value="explain_own_words">Explique com suas palavras</option><option value="decision">Decisão principal</option><option value="application">Aplicação</option></select></label>
      </div>
      <div className="knowledge-form-actions"><button type="button" className="primary-btn" disabled={saving || !draft.question.trim() || !draft.answer.trim()} onClick={() => onSave(draft)}>{saving ? 'Salvando...' : label}</button>{onReject && <button type="button" className="ghost-btn" onClick={onReject}>Rejeitar sugestão</button>}</div>
    </article>
  );
}
