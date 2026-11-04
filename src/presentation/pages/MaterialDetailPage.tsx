import React from 'react';
import { labels } from '../i18n/labels';

export function MaterialDetailPage(): React.ReactElement {
  return (
    <div className="page-stack">
      <h1>{labels.materialDetail.summaryHeading}</h1>
    </div>
  );
}

export default MaterialDetailPage;
