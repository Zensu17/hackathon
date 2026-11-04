import React from 'react';
import { labels } from '../i18n/labels';

export function RepFormPage(): React.ReactElement {
  return (
    <div className="page-stack">
      <h1>{labels.repForm.createHeading}</h1>
    </div>
  );
}

export default RepFormPage;
