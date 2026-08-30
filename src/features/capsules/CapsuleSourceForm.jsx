export default function CapsuleSourceForm({ value, onChange, disabled, onSubmit, submitLabel = 'Criar cápsula' }) {
  return (
    <form className="capsule-source-form" onSubmit={onSubmit}>
      <label htmlFor="capsule-source-text">
        <strong>Adicionar texto ou transcrição</strong>
        <span>Cole o artigo, legenda, transcrição, anotações ou um trecho importante. Esse texto terá prioridade na análise.</span>
      </label>
      <textarea
        id="capsule-source-text"
        value={value}
        onChange={event => onChange(event.target.value)}
        maxLength={80000}
        disabled={disabled}
        placeholder="Cole aqui o conteúdo que você deseja transformar em conhecimento..."
      />
      <div className="capsule-source-footer">
        <small>{value.length.toLocaleString('pt-BR')} de 80.000 caracteres</small>
        <button type="submit" className="primary-btn" disabled={disabled}>{submitLabel}</button>
      </div>
    </form>
  );
}
