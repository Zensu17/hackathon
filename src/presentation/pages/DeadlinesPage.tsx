import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { DeadlineItem, SegmentedControl } from '../components/FigmaComponents';
import { IconArrowLeft, IconDownload } from '../components/Icons';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { useAuthSession } from '../hooks/useAuthSession';
import { useUpcomingDeadlines } from '../hooks/useUpcomingDeadlines';
import { labels } from '../i18n/labels';
import { buildDeadlinesIcs, triggerTextDownload } from '../utils/exportUtils';
import { formatDateTime, formatRelativeDue } from '../utils/formatters';

type DeadlineFilter = 'all' | 'week' | 'overdue' | 'completed';

function isWithinSevenDays(dueAt: string, now = Date.now()): boolean {
  const dueMs = Date.parse(dueAt);
  return dueMs >= now && dueMs <= now + 7 * 24 * 60 * 60 * 1000;
}

export function DeadlinesPage(): React.ReactElement {
  const { session } = useAuthSession();
  const {
    result,
    completedIds,
    toggleCompleted,
    isLoading,
    error,
    reload,
  } = useUpcomingDeadlines(session?.user.id ?? null);
  const [filter, setFilter] = useState<DeadlineFilter>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');

  useEffect(() => {
    document.title = `${labels.deadlines.heading} | ${labels.app.name}`;
  }, []);

  const allItems = result?.items ?? [];
  const courseOptions = useMemo(() => {
    const byId = new Map<
      string,
      { courseId: string; courseCode: string; courseName: string }
    >();
    for (const item of allItems) {
      if (!byId.has(item.courseId)) {
        byId.set(item.courseId, {
          courseId: item.courseId,
          courseCode: item.courseCode,
          courseName: item.courseName,
        });
      }
    }
    return Array.from(byId.values()).sort((a, b) =>
      a.courseCode.localeCompare(b.courseCode),
    );
  }, [allItems]);

  const courseScopedItems = useMemo(() => {
    if (courseFilter === 'all') {
      return allItems;
    }
    const exists = allItems.some((item) => item.courseId === courseFilter);
    return exists
      ? allItems.filter((item) => item.courseId === courseFilter)
      : allItems;
  }, [allItems, courseFilter]);

  const activeItems = useMemo(
    () => courseScopedItems.filter((item) => !completedIds.has(item.id)),
    [completedIds, courseScopedItems],
  );
  const completedItems = useMemo(
    () => courseScopedItems.filter((item) => completedIds.has(item.id)),
    [completedIds, courseScopedItems],
  );
  const weekCount = useMemo(
    () => activeItems.filter((item) => isWithinSevenDays(item.dueAt)).length,
    [activeItems],
  );
  const overdueCount = useMemo(
    () => activeItems.filter((item) => item.isOverdue).length,
    [activeItems],
  );

  const items = useMemo(() => {
    if (filter === 'completed') return completedItems;
    if (filter === 'overdue') return activeItems.filter((item) => item.isOverdue);
    if (filter === 'week')
      return activeItems.filter((item) => isWithinSevenDays(item.dueAt));
    return activeItems;
  }, [activeItems, completedItems, filter]);

  const handleExportIcs = (): void => {
    const exportTarget = items.length > 0 ? items : activeItems;
    if (exportTarget.length === 0) {
      toast.info('No deadlines available to export.');
      return;
    }
    const selectedCourse = courseOptions.find(
      (c) => c.courseId === courseFilter,
    );
    const slug = selectedCourse
      ? `-${selectedCourse.courseCode.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
      : '';
    triggerTextDownload(
      `litelearn-deadlines${slug}.ics`,
      buildDeadlinesIcs(exportTarget),
      'text/calendar;charset=utf-8',
    );
    toast.success(
      `Exported ${exportTarget.length} deadline${exportTarget.length === 1 ? '' : 's'} to calendar (.ics).`,
    );
  };

  const grouped = useMemo(() => {
    const overdue = items.filter((item) => item.isOverdue);
    const dueSoon = items.filter((item) => !item.isOverdue && item.isDueSoon);
    const later = items.filter((item) => !item.isOverdue && !item.isDueSoon);
    return { overdue, dueSoon, later };
  }, [items]);

  const handleToggleDeadline = async (
    deadlineId: string,
    title: string,
  ): Promise<void> => {
    const nowDone = await toggleCompleted(deadlineId);
    toast(
      nowDone
        ? `${labels.deadlines.markedDoneToast} (${title})`
        : `${labels.deadlines.markedUndoneToast} (${title})`,
      {
        action: {
          label: labels.deadlines.undoCta,
          onClick: () => {
            void toggleCompleted(deadlineId, !nowDone);
          },
        },
      },
    );
  };

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

  const totalCompletedCount = allItems.filter((item) =>
    completedIds.has(item.id),
  ).length;
  const progressPercent =
    allItems.length > 0
      ? Math.round((totalCompletedCount / allItems.length) * 100)
      : 0;

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

      {allItems.length > 0 ? (
        <section
          className="index-card deadline-progress-card"
          aria-label="Study completion progress"
        >
          <div className="deadline-progress-card__head">
            <span className="deadline-progress-card__title">
              Completion across followed courses
            </span>
            <span className="deadline-progress-card__meta tabular-nums">
              {`${totalCompletedCount} of ${allItems.length} completed (${progressPercent}%)`}
            </span>
          </div>
          <div
            className="offline-meter"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Deadlines completed ${progressPercent}%`}
          >
            <div
              className={
                progressPercent === 100
                  ? 'offline-meter__fill offline-meter__fill--complete'
                  : 'offline-meter__fill'
              }
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </section>
      ) : null}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div className="filter-tab-bar" style={{ maxWidth: '620px', flex: '1 1 320px' }}>
          <SegmentedControl<DeadlineFilter>
            options={['all', 'week', 'overdue', 'completed']}
            active={filter}
            onChange={setFilter}
            labelsMap={{
              all: `${labels.deadlines.filterAll} (${activeItems.length})`,
              week: `${labels.deadlines.filterWeek} (${weekCount})`,
              overdue: `${labels.deadlines.filterOverdue} (${overdueCount})`,
              completed: `${labels.deadlines.filterCompleted} (${completedItems.length})`,
            }}
          />
        </div>

        {allItems.length > 0 ? (
          <div className="action-row" style={{ marginTop: 0 }}>
            {courseOptions.length > 1 ? (
              <select
                id="deadlines-course-filter"
                name="deadlinesCourseFilter"
                aria-label="Filter deadlines by course"
                className="member-role-select"
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
              >
                <option value="all">{`All courses (${courseOptions.length})`}</option>
                {courseOptions.map((c) => (
                  <option key={c.courseId} value={c.courseId}>
                    {`${c.courseCode} - ${c.courseName}`}
                  </option>
                ))}
              </select>
            ) : null}

            <button
              type="button"
              className="btn btn-secondary btn-compact"
              onClick={handleExportIcs}
              disabled={items.length === 0 && activeItems.length === 0}
            >
              <IconDownload size={15} />
              <span>Export calendar (.ics)</span>
            </button>
          </div>
        ) : null}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title={labels.deadlines.emptyTitle}
          body={
            filter === 'completed'
              ? labels.deadlines.emptyCompletedBody
              : filter === 'all' && allItems.length === 0
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
                    completed={completedIds.has(item.id)}
                    onToggleComplete={() =>
                      void handleToggleDeadline(item.id, item.title)
                    }
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
                    completed={completedIds.has(item.id)}
                    onToggleComplete={() =>
                      void handleToggleDeadline(item.id, item.title)
                    }
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
                    completed={completedIds.has(item.id)}
                    onToggleComplete={() =>
                      void handleToggleDeadline(item.id, item.title)
                    }
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
              completed={completedIds.has(item.id)}
              onToggleComplete={() =>
                void handleToggleDeadline(item.id, item.title)
              }
            />
          ))}
        </section>
      )}
    </div>
  );
}

export default DeadlinesPage;
