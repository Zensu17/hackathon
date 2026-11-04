import React from 'react';
import { labels } from '../i18n/labels';

export function HomePage(): React.ReactElement {
  return (
    <div className="page-stack">
      <h1>{labels.home.heading}</h1>
    </div>
  );
}

export default HomePage;
