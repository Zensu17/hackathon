import React from 'react';
import { labels } from '../i18n/labels';

export function CoursesPage(): React.ReactElement {
  return (
    <div className="page-stack">
      <h1>{labels.courses.heading}</h1>
    </div>
  );
}

export default CoursesPage;
