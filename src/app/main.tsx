import React from 'react';
import { createRoot } from 'react-dom/client';
import '../presentation/styles/tokens.css';
import '../presentation/styles/base.css';
import '../presentation/styles/pages.css';
import { AppContainerProvider } from './di';
import { AppRouter } from './router';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Missing #root mount element in index.html');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <AppContainerProvider>
      <AppRouter />
    </AppContainerProvider>
  </React.StrictMode>,
);
