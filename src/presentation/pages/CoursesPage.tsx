import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/StateViews';
import { Chip } from '../components/FigmaComponents';
import { useAuthSession } from '../hooks/useAuthSession';
import { useCourses } from '../hooks/useCourses';
import { labels } from '../i18n/labels';

export function CoursesPage(): React.ReactElement {
  const { session } = useAuthSession();
  const classId = session?.user.classId ?? null;
  const userId = session?.user.id ?? null;
  const isRep = session?.user.role === 'rep';

  const [filterMode, setFilterMode] = useState<'all' | 'following'>('all');

  const {
    courses,
    isLoading,
    error,
    pendingCourseId,
    reload,
    toggleFollow,
  } = useCourses(classId, userId);

  useEffect(() => {
    document.title = `${labels.courses.heading} | ${labels.app.name}`;
  }, []);

  const followedCourses = courses.filter((course) => course.isFollowed);
  const displayedCourses =
    filterMode === 'following' ? followedCourses : courses;

  return (
    <div className="page-stack">
      <header className="page-header">
        <div className="page-header__top">
          <div className="page-header__title-group">
            <h1>{labels.courses.heading}</h1>
            <p className="page-lead">{labels.courses.intro}</p>
          </div>
          {isRep ? (
            <Link
              to="/manage?type=course"
              className="btn btn-primary btn-compact"
            >
              {labels.courses.addCourseCta}
            </Link>
          ) : null}
        </div>
      </header>

      {isLoading ? <LoadingState message={labels.courses.loading} /> : null}

      {!isLoading && error ? (
        <ErrorState
          title={labels.courses.errorTitle}
          detail={error}
          onRetry={() => void reload()}
        />
      ) : null}

      {!isLoading && !error && courses.length === 0 ? (
        <EmptyState
          title={labels.courses.emptyTitle}
          body={
            isRep ? labels.courses.emptyBodyRep : labels.courses.emptyBodyStudent
          }
          actionLabel={isRep ? labels.courses.emptyRepCta : undefined}
          actionTo={isRep ? '/manage?type=course' : undefined}
        />
      ) : null}

      {!isLoading && !error && courses.length > 0 ? (
        <div className="card-stack">
          <div
            className="type-selector"
            role="tablist"
            aria-label={labels.courses.filterAriaLabel}
          >
            <button
              type="button"
              role="tab"
              aria-selected={filterMode === 'all'}
              className={
                filterMode === 'all'
                  ? 'btn btn-secondary btn-compact btn-toggle'
                  : 'btn btn-secondary btn-compact'
              }
              aria-pressed={filterMode === 'all'}
              onClick={() => setFilterMode('all')}
            >
              {`${labels.courses.filterAll} (${courses.length})`}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterMode === 'following'}
              className={
                filterMode === 'following'
                  ? 'btn btn-secondary btn-compact btn-toggle'
                  : 'btn btn-secondary btn-compact'
              }
              aria-pressed={filterMode === 'following'}
              onClick={() => setFilterMode('following')}
            >
              {`${labels.courses.filterFollowing} (${followedCourses.length})`}
            </button>
          </div>

          {filterMode === 'following' && followedCourses.length === 0 ? (
            <EmptyState
              title={labels.courses.noFollowedFilterTitle}
              body={labels.courses.noFollowedFilterBody}
              actionLabel={labels.courses.filterAll}
              onAction={() => setFilterMode('all')}
            />
          ) : (
            displayedCourses.map((course, idx) => {
              const isPending = pendingCourseId === course.id;
              const accent = (((idx % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6);
              return (
                <article
                  key={course.id}
                  className="index-card index-card--interactive"
                  style={{ borderTop: `4px solid var(--course-${accent})` }}
                >
                  <div className="card-tab-bar">
                    <span className="card-tab-code">[{course.code}]</span>
                    {course.isFollowed ? (
                      <Chip type="info" size="S" label="Following" />
                    ) : null}
                  </div>

                  <h2>{course.name}</h2>

                  {course.description ? (
                    <p className="meta-text">{course.description}</p>
                  ) : null}

                  <div className="action-row">
                    <Link
                      to={`/courses/${course.id}`}
                      className="figma-btn figma-btn--primary figma-btn--size-m"
                    >
                      {labels.courses.openWeeksCta}
                    </Link>

                    <button
                      type="button"
                      className="figma-btn figma-btn--secondary figma-btn--size-m"
                      aria-pressed={course.isFollowed}
                      disabled={isPending}
                      onClick={() =>
                        void toggleFollow(course.id, course.isFollowed)
                      }
                    >
                      {course.isFollowed
                        ? labels.courses.followingLabel
                        : labels.courses.followCta}
                    </button>

                    {isRep ? (
                      <Link
                        to={`/manage?type=course&editId=${course.id}`}
                        className="figma-btn figma-btn--ghost figma-btn--size-m"
                      >
                        {labels.courses.editCourseCta}
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

export default CoursesPage;
