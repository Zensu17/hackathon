import React from 'react';
import { createRoot } from 'react-dom/client';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Missing #root mount element in index.html');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <main id="main-content">
      <h1>LiteLearn</h1>
    </main>
  </React.StrictMode>,
);
