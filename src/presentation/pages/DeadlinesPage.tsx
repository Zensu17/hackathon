import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { DeadlineItem } from '../components/FigmaComponents';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { useAuthSession } from '../hooks/useAuthSession';
import { useUpcomingDeadlines } from '../hooks/useUpcomingDeadlines';
import { labels } from '../i18n/labels';
import { formatDateTime } from '../utils/formatters';

type DeadlineFilter = 'all' | 'week' | 'overdue';

function isWithinSevenDays(dueAt: string, now = Date.now()): boolean {
  const dueMs = Date.parse(dueAt);
  return dueMs >= now && dueMs <= now + 7 * 24 * 60 * 60 * 1000;
}

export function DeadlinesPage(): React.ReactElement {
  const { session } = useAuthSession();
  const { result, isLoading, error, reload } = useUpcomingDeadlines(
    session?.user.id ?? null,
  );
  const [filter, setFilter] = useState<DeadlineFilter>('all');

  useEffect(() => {
    document.title = `${labels.deadlines.heading} | ${labels.app.name}`;
  }, []);

  const items = useMemo(() => {
    const allItems = result?.items ?? [];
    if (filter === 'overdue') return allItems.filter((item) => item.isOverdue);
    if (filter === 'week') return allItems.filter((item) => isWithinSevenDays(item.dueAt));
    return allItems;
  }, [filter, result?.items]);

  if (isLoading) {
    return <LoadingState message={labels.deadlines.loading} />;
  }

  if (error) {
    return <ErrorState title={labels.deadlines.errorTitle} detail={error} onRetry={() => void reload()} />;
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div className="page-header__top">
          <div className="page-header__title-group">
            <h1>{labels.deadlines.heading}</h1>
            <p className="page-lead">{labels.deadlines.intro}</p>
          </div>
          <Link to="/" className="btn btn-secondary btn-compact">
            {labels.deadlines.backToHome}
          </Link>
        </div>
      </header>

      <div className="filter-tab-bar" role="tablist" aria-label={labels.deadlines.filterAriaLabel}>
        {([
          ['all', labels.deadlines.filterAll],
          ['week', labels.deadlines.filterWeek],
          ['overdue', labels.deadlines.filterOverdue],
        ] as const).map(([value, text]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            className={`btn btn-secondary btn-compact ${filter === value ? 'btn-toggle' : ''}`}
            onClick={() => setFilter(value)}
          >
            {text}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title={labels.deadlines.emptyTitle}
          body={filter === 'all' ? labels.deadlines.emptyBody : labels.deadlines.emptyFilteredBody}
          actionLabel={filter === 'all' ? undefined : labels.deadlines.filterAll}
          onAction={filter === 'all' ? undefined : () => setFilter('all')}
        />
      ) : (
        <section className="index-card" aria-label={labels.deadlines.heading}>
          <div className="card-stack">
            {items.map((item) => (
              <DeadlineItem
                key={item.id}
                title={item.title}
                course={`${item.courseCode} - ${item.courseName}`}
                dueText={formatDateTime(item.dueAt)}
                urgency={item.isOverdue ? 'overdue' : item.isDueSoon ? 'due soon' : 'normal'}
                courseId={item.courseId}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default DeadlinesPage;
