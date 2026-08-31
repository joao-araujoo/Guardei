import React from 'react';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Guardei encontrou um erro inesperado na interface.', {
      name: error?.name,
      message: error?.message,
      componentStack: info?.componentStack
    });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="fatal-error-shell" role="alert">
        <section className="fatal-error-card">
          <span className="eyebrow">Algo saiu do lugar</span>
          <h1>Seu acervo continua seguro.</h1>
          <p>A interface encontrou um erro inesperado. Recarregue o Guardei para reconstruir a tela sem apagar seus dados.</p>
          <div className="fatal-error-actions">
            <button className="primary-btn" type="button" onClick={() => window.location.reload()}>
              Recarregar Guardei
            </button>
            <button
              className="secondary-btn"
              type="button"
              onClick={() => {
                window.history.replaceState({}, document.title, '/');
                window.location.reload();
              }}
            >
              Voltar para o início
            </button>
          </div>
        </section>
      </main>
    );
  }
}
