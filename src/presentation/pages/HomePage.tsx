import React, { useEffect } from 'react';
import { Link } from 'react-router';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/StateViews';
import {
  CourseCard,
  DeadlineItem,
  Chip,
} from '../components/FigmaComponents';
import { IconPlus } from '../components/Icons';
import { useAuthSession } from '../hooks/useAuthSession';
import { useCourses } from '../hooks/useCourses';
import { useUpcomingDeadlines } from '../hooks/useUpcomingDeadlines';
import { labels } from '../i18n/labels';
import { formatDateTime } from '../utils/formatters';

export function HomePage(): React.ReactElement {
  const { session } = useAuthSession();
  const userId = session?.user.id ?? null;
  const classId = session?.user.classId ?? null;
  const isRep = session?.user.role === 'rep';

  const { result, isLoading: deadlinesLoading, error: deadlinesError, reload: reloadDeadlines } = useUpcomingDeadlines(userId);
  const {
    courses,
    isLoading: coursesLoading,
    error: coursesError,
    reload: reloadCourses,
    toggleFollow,
  } = useCourses(classId, userId);

  useEffect(() => {
    document.title = `${labels.home.heading} | ${labels.app.name}`;
  }, []);

  const followedCount = result?.followedCourseCount ?? 0;
  const followedSummary =
    followedCount === 1
      ? `${labels.home.followedSummaryPrefix} ${labels.home.followedSummarySingular}`
      : `${labels.home.followedSummaryPrefix} ${followedCount} ${labels.home.followedSummaryPluralSuffix}`;

  const allItems = result?.items ?? [];
  const urgentItems = allItems.filter(
    (item) => item.isOverdue || item.isDueSoon,
  );

  const nextDeadline = urgentItems[0] ?? allItems[0] ?? null;
  const remainingDeadlines = nextDeadline
    ? allItems.filter((i) => i.id !== nextDeadline.id)
    : allItems;

  const followedCourses = courses.filter((c) => c.isFollowed);
  const displayCourses = followedCourses.length > 0 ? followedCourses : courses.slice(0, 3);

  const isLoading = deadlinesLoading || coursesLoading;
  const error = deadlinesError ?? coursesError;

  return (
    <div className="page-stack">
      <header className="page-header">
        <div className="page-header__top">
          <div className="page-header__title-group">
            <h1>{labels.home.heading}</h1>
            {!isLoading && !error && result && followedCount > 0 ? (
              <p className="page-lead">{followedSummary}</p>
            ) : null}
          </div>
          {isRep ? (
            <Link
              to="/manage?type=deadline"
              className="btn btn-secondary btn-compact"
            >
              <IconPlus size={16} />
              <span>{labels.home.addDeadlineCta}</span>
            </Link>
          ) : null}
        </div>
      </header>

      {isLoading ? <LoadingState message={labels.home.loading} /> : null}

      {!isLoading && error ? (
        <ErrorState
          title={labels.home.errorTitle}
          detail={error}
          onRetry={() => {
            void reloadDeadlines();
            void reloadCourses();
          }}
        />
      ) : null}

      {!isLoading && !error && result && result.followedCourseCount === 0 ? (
        <EmptyState
          title={labels.home.emptyNoFollowedTitle}
          body={labels.home.emptyNoFollowedBody}
          actionLabel={labels.home.emptyNoFollowedCta}
          actionTo="/courses"
        />
      ) : null}

      {!isLoading &&
      !error &&
      result &&
      result.followedCourseCount > 0 &&
      result.items.length === 0 ? (
        <EmptyState
          title={labels.home.emptyNoDeadlinesTitle}
          body={labels.home.emptyNoDeadlinesBody}
        />
      ) : null}

      {!isLoading && !error && (allItems.length > 0 || displayCourses.length > 0) ? (
        <div className="figma-home-grid">
          {/* Left Column: Next deadline and upcoming items */}
          <div className="card-stack">
            {nextDeadline ? (
              <section className="section-block" aria-labelledby="next-deadline-heading">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <h2 id="next-deadline-heading" style={{ margin: 0 }}>
                    Next deadline
                  </h2>
                </div>
                <article
                  className={
                    nextDeadline.isOverdue || nextDeadline.isDueSoon
                      ? 'index-card index-card--urgent'
                      : 'index-card'
                  }
                >
                  <div className="card-tab-bar">
                    <span className="card-tab-code">{`[${nextDeadline.courseCode}]`}</span>
                    <Chip
                      type={
                        nextDeadline.isOverdue
                          ? 'danger'
                          : nextDeadline.isDueSoon
                            ? 'warning'
                            : 'neutral'
                      }
                      size="S"
                      label={
                        nextDeadline.isOverdue
                          ? labels.home.statusOverdue
                          : nextDeadline.isDueSoon
                            ? labels.home.statusDueSoon
                            : labels.home.statusScheduled
                      }
                    />
                  </div>
                  <h3>
                    <Link to={`/courses/${nextDeadline.courseId}`} className="card-title-link">
                      {nextDeadline.title}
                    </Link>
                  </h3>
                  <p className="meta-text">
                    {nextDeadline.courseName}
                  </p>
                  <p style={{ fontWeight: 600, color: nextDeadline.isOverdue ? 'var(--color-danger)' : 'var(--color-text)', marginTop: 'var(--space-1)' }}>
                    {`${labels.home.duePrefix} ${formatDateTime(nextDeadline.dueAt)}`}
                  </p>
                  {nextDeadline.description ? (
                    <p style={{ marginTop: 'var(--space-2)' }}>{nextDeadline.description}</p>
                  ) : null}
                  <div className="action-row" style={{ marginTop: 'var(--space-3)' }}>
                    <Link
                      to={`/courses/${nextDeadline.courseId}`}
                      className="figma-btn figma-btn--primary figma-btn--size-m"
                    >
                      View deadline
                    </Link>
                  </div>
                </article>
              </section>
            ) : null}

            {remainingDeadlines.length > 0 ? (
              <section className="section-block" aria-labelledby="upcoming-heading">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <h2 id="upcoming-heading" style={{ margin: 0 }}>
                    Upcoming
                  </h2>
                  <Link to="/deadlines" style={{ fontSize: 'var(--type-small-size)', fontWeight: 600 }}>
                    See all
                  </Link>
                </div>
                <div className="index-card">
                  {remainingDeadlines.slice(0, 5).map((item) => (
                    <DeadlineItem
                      key={item.id}
                      title={item.title}
                      course={`${item.courseCode} - ${item.courseName}`}
                      dueText={formatDateTime(item.dueAt)}
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
                </div>
              </section>
            ) : null}
          </div>

          {/* Right Column: Followed courses and latest announcements */}
          <div className="card-stack">
            <section className="section-block" aria-labelledby="courses-heading">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <h2 id="courses-heading" style={{ margin: 0 }}>
                  Your courses
                </h2>
                <Link to="/courses" style={{ fontSize: 'var(--type-small-size)', fontWeight: 600 }}>
                  See all
                </Link>
              </div>
              <div className="card-stack">
                {displayCourses.map((c, idx) => (
                  <CourseCard
                    key={c.id}
                    courseId={c.id}
                    name={c.name}
                    code={c.code}
                    accent={(((idx % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6)}
                    followed={c.isFollowed}
                    onToggleFollow={() => void toggleFollow(c.id, c.isFollowed)}
                  />
                ))}
              </div>
            </section>

            <section className="section-block" aria-labelledby="announcements-heading">
              <h2 id="announcements-heading">
                Latest announcements
              </h2>
              <div className="index-card">
                <div style={{ padding: 'var(--space-2) 0' }}>
                  <p style={{ margin: '0 0 var(--space-1)', fontSize: 'var(--type-caption-size)', color: 'var(--color-text-muted)' }}>
                    IT Del Academic Office
                  </p>
                  <p style={{ margin: 0, fontSize: 'var(--type-body-size)', fontWeight: 600 }}>
                    Midterm project schedules and weekly lecture summaries are cached locally on this device.
                  </p>
                </div>
              </div>
              <p style={{ fontSize: 'var(--type-caption-size)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
                Saved on this device. Ready offline.
              </p>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default HomePage;
