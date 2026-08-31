import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './lib/localIconify.js';
import './local-icons.css';
import App from './App.jsx';
import AppErrorBoundary from './AppErrorBoundary.jsx';
import ProductShell from './ProductShell.jsx';
import PushBootstrap from './PushBootstrap.jsx';
import EverywhereLayer from './features/everywhere/EverywhereLayer.jsx';
import './styles.css';
import './design-system.css';
import './product-completion.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

function ExperienceRoot() {
  const [revision, setRevision] = useState(0);
  const hiddenAtRef = useRef(0);

  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
        return;
      }
      if (hiddenAtRef.current && Date.now() - hiddenAtRef.current > 3000) refresh();
      hiddenAtRef.current = 0;
    };

    window.addEventListener('guardei:vault-changed', refresh);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('guardei:vault-changed', refresh);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <>
      <ProductShell key={revision}>
        <App />
      </ProductShell>
      <EverywhereLayer />
      <PushBootstrap />
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <ExperienceRoot />
    </AppErrorBoundary>
  </React.StrictMode>
);
