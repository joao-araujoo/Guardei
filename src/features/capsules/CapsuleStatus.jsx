const STATUS_MESSAGES = {
  idle: 'Aguardando criação da cápsula.',
  extracting: 'Obtendo o conteúdo disponível.',
  generating: 'Organizando os principais aprendizados.',
  completed: 'Cápsula concluída.',
  limited: 'A análise foi concluída com cobertura limitada.',
  failed: 'O processamento falhou. Tente novamente.'
};

const COVERAGE_MESSAGES = {
  full_content: 'Análise baseada no texto completo.',
  user_content: 'Análise baseada no texto ou transcrição fornecida.',
  metadata_only: 'Análise limitada aos metadados públicos.',
  partial_content: 'Apenas parte do conteúdo estava disponível.'
};

export default function CapsuleStatus({ status = 'idle', coverage, confidence, generatedAt }) {
  const confidenceValue = Number.isFinite(Number(confidence)) ? Math.round(Number(confidence) * 100) : null;
  return (
    <div className="capsule-status" aria-live="polite" aria-atomic="true">
      <span className={`capsule-status-dot ${status}`} aria-hidden="true" />
      <div>
        <strong>{STATUS_MESSAGES[status] || STATUS_MESSAGES.idle}</strong>
        {coverage && <small>{COVERAGE_MESSAGES[coverage] || 'Cobertura da análise não informada.'}</small>}
        <div className="capsule-status-meta">
          {confidenceValue !== null && <span>Confiança: {confidenceValue}%</span>}
          {generatedAt && <span>Atualizada em {new Date(generatedAt).toLocaleString('pt-BR')}</span>}
        </div>
      </div>
    </div>
  );
}

export { COVERAGE_MESSAGES, STATUS_MESSAGES };
