import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { DeadlineItem, SegmentedControl } from '../components/FigmaComponents';
import { IconArrowLeft } from '../components/Icons';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { useAuthSession } from '../hooks/useAuthSession';
import { useUpcomingDeadlines } from '../hooks/useUpcomingDeadlines';
import { labels } from '../i18n/labels';
import { formatDateTime, formatRelativeDue } from '../utils/formatters';

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

  const allItems = result?.items ?? [];
  const weekCount = useMemo(
    () => allItems.filter((item) => isWithinSevenDays(item.dueAt)).length,
    [allItems],
  );
  const overdueCount = useMemo(
    () => allItems.filter((item) => item.isOverdue).length,
    [allItems],
  );

  const items = useMemo(() => {
    if (filter === 'overdue') return allItems.filter((item) => item.isOverdue);
    if (filter === 'week')
      return allItems.filter((item) => isWithinSevenDays(item.dueAt));
    return allItems;
  }, [filter, allItems]);

  const grouped = useMemo(() => {
    const overdue = items.filter((item) => item.isOverdue);
    const dueSoon = items.filter((item) => !item.isOverdue && item.isDueSoon);
    const later = items.filter((item) => !item.isOverdue && !item.isDueSoon);
    return { overdue, dueSoon, later };
  }, [items]);

  if (isLoading) {
    return <LoadingState message={labels.deadlines.loading} />;
  }

  if (error) {
    return (
      <ErrorState
        title={labels.deadlines.errorTitle}
        detail={error}
        onRetry={() => void reload()}
      />
    );
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div className="page-header__top">
          <div className="page-header__title-group">
            <h1>{labels.deadlines.heading}</h1>
            <p className="page-lead">{labels.deadlines.intro}</p>
          </div>
          <Link to="/" className="breadcrumb-link">
            <IconArrowLeft size={15} />
            <span>{labels.deadlines.backToHome}</span>
          </Link>
        </div>
      </header>

      <div className="filter-tab-bar">
        <SegmentedControl<DeadlineFilter>
          options={['all', 'week', 'overdue']}
          active={filter}
          onChange={setFilter}
          labelsMap={{
            all: `${labels.deadlines.filterAll} (${allItems.length})`,
            week: `${labels.deadlines.filterWeek} (${weekCount})`,
            overdue: `${labels.deadlines.filterOverdue} (${overdueCount})`,
          }}
        />
      </div>

      {items.length === 0 ? (
        <EmptyState
          title={labels.deadlines.emptyTitle}
          body={
            filter === 'all'
              ? labels.deadlines.emptyBody
              : labels.deadlines.emptyFilteredBody
          }
          actionLabel={filter === 'all' ? undefined : labels.deadlines.filterAll}
          onAction={filter === 'all' ? undefined : () => setFilter('all')}
        />
      ) : filter === 'all' ? (
        <div className="card-stack">
          {grouped.overdue.length > 0 ? (
            <section className="section-block" aria-labelledby="deadlines-overdue-heading">
              <h2
                id="deadlines-overdue-heading"
                style={{ color: 'var(--color-danger)', margin: 0 }}
              >
                {`${labels.home.statusOverdue} (${grouped.overdue.length})`}
              </h2>
              <div className="index-card index-card--urgent" style={{ paddingTop: '10px', paddingBottom: '10px' }}>
                {grouped.overdue.map((item) => (
                  <DeadlineItem
                    key={item.id}
                    title={item.title}
                    course={`${item.courseCode} - ${item.courseName}`}
                    dueText={formatDateTime(item.dueAt)}
                    relativeText={formatRelativeDue(item.dueAt)}
                    urgency="overdue"
                    courseId={item.courseId}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {grouped.dueSoon.length > 0 ? (
            <section className="section-block" aria-labelledby="deadlines-soon-heading">
              <h2 id="deadlines-soon-heading" style={{ margin: 0 }}>
                {`${labels.home.statusDueSoon} (${grouped.dueSoon.length})`}
              </h2>
              <div className="index-card" style={{ paddingTop: '10px', paddingBottom: '10px' }}>
                {grouped.dueSoon.map((item) => (
                  <DeadlineItem
                    key={item.id}
                    title={item.title}
                    course={`${item.courseCode} - ${item.courseName}`}
                    dueText={formatDateTime(item.dueAt)}
                    relativeText={formatRelativeDue(item.dueAt)}
                    urgency="due soon"
                    courseId={item.courseId}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {grouped.later.length > 0 ? (
            <section className="section-block" aria-labelledby="deadlines-later-heading">
              <h2 id="deadlines-later-heading" style={{ margin: 0 }}>
                {`${labels.home.statusScheduled} (${grouped.later.length})`}
              </h2>
              <div className="index-card" style={{ paddingTop: '10px', paddingBottom: '10px' }}>
                {grouped.later.map((item) => (
                  <DeadlineItem
                    key={item.id}
                    title={item.title}
                    course={`${item.courseCode} - ${item.courseName}`}
                    dueText={formatDateTime(item.dueAt)}
                    relativeText={formatRelativeDue(item.dueAt)}
                    urgency="normal"
                    courseId={item.courseId}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <section
          className="index-card"
          aria-label={labels.deadlines.heading}
          style={{ paddingTop: '10px', paddingBottom: '10px' }}
        >
          {items.map((item) => (
            <DeadlineItem
              key={item.id}
              title={item.title}
              course={`${item.courseCode} - ${item.courseName}`}
              dueText={formatDateTime(item.dueAt)}
              relativeText={formatRelativeDue(item.dueAt)}
              urgency={
                item.isOverdue
                  ? 'overdue'
                  : item.isDueSoon
                    ? 'due soon'
                    : 'normal'
              }
              courseId={item.courseId}
            />
          ))}
        </section>
      )}
    </div>
  );
}

export default DeadlinesPage;
