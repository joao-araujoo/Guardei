import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ProductShell from './ProductShell.jsx';
import PushBootstrap from './PushBootstrap.jsx';
import './styles.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ProductShell>
      <App />
    </ProductShell>
    <PushBootstrap />
  </React.StrictMode>
);
