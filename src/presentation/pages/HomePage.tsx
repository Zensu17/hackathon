import React, { useEffect } from 'react';
import { Link } from 'react-router';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/StateViews';
import { useAuthSession } from '../hooks/useAuthSession';
import { useUpcomingDeadlines } from '../hooks/useUpcomingDeadlines';
import { labels } from '../i18n/labels';
import { formatDateTime } from '../utils/formatters';

export function HomePage(): React.ReactElement {
  const { session } = useAuthSession();
  const userId = session?.user.id ?? null;
  const isRep = session?.user.role === 'rep';
  const { result, isLoading, error, reload } = useUpcomingDeadlines(userId);

  useEffect(() => {
    document.title = `${labels.home.heading} | ${labels.app.name}`;
  }, []);

  const followedCount = result?.followedCourseCount ?? 0;
  const followedSummary =
    followedCount === 1
      ? `${labels.home.followedSummaryPrefix} ${labels.home.followedSummarySingular}`
      : `${labels.home.followedSummaryPrefix} ${followedCount} ${labels.home.followedSummaryPluralSuffix}`;

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
              {labels.home.addDeadlineCta}
            </Link>
          ) : null}
        </div>
      </header>

      {isLoading ? <LoadingState message={labels.home.loading} /> : null}

      {!isLoading && error ? (
        <ErrorState
          title={labels.home.errorTitle}
          detail={error}
          onRetry={() => void reload()}
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

      {!isLoading && !error && result && result.items.length > 0 ? (
        <div className="card-stack">
          {result.items.map((item) => {
            const isUrgent = item.isOverdue || item.isDueSoon;
            const statusText = item.isOverdue
              ? labels.home.statusOverdue
              : item.isDueSoon
                ? labels.home.statusDueSoon
                : labels.home.statusScheduled;

            return (
              <article
                key={item.id}
                className={
                  isUrgent ? 'index-card index-card--urgent' : 'index-card'
                }
              >
                <div className="card-tab-bar">
                  <span className="card-tab-code">{`[${item.courseCode}]`}</span>
                  <span
                    className={
                      isUrgent
                        ? 'status-chip status-chip--urgent'
                        : 'status-chip'
                    }
                  >
                    {statusText}
                  </span>
                </div>

                <h2>
                  <Link
                    to={`/courses/${item.courseId}`}
                    className="card-title-link"
                  >
                    {item.title}
                  </Link>
                </h2>

                <p className="meta-text">
                  {`${labels.home.duePrefix} ${formatDateTime(item.dueAt)} (${item.courseName})`}
                </p>

                {item.description ? (
                  <p style={{ marginTop: 'var(--space-2)' }}>
                    {item.description}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default HomePage;
