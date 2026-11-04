import React from 'react';
import { createRoot } from 'react-dom/client';
import '../presentation/styles/tokens.css';
import '../presentation/styles/base.css';
import { labels } from '../presentation/i18n/labels';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Missing #root mount element in index.html');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <main id="main-content">
      <h1>{labels.app.name}</h1>
    </main>
  </React.StrictMode>,
);
