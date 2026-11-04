import React from 'react';
import { labels } from '../i18n/labels';

export function CourseDetailPage(): React.ReactElement {
  return (
    <div className="page-stack">
      <h1>{labels.courseDetail.weeksHeading}</h1>
    </div>
  );
}

export default CourseDetailPage;
