import React, { useEffect } from 'react';
import { Link } from 'react-router';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/StateViews';
import { useAuthSession } from '../hooks/useAuthSession';
import { useCourses } from '../hooks/useCourses';
import { labels } from '../i18n/labels';

export function CoursesPage(): React.ReactElement {
  const { session } = useAuthSession();
  const classId = session?.user.classId ?? null;
  const userId = session?.user.id ?? null;
  const isRep = session?.user.role === 'rep';

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
          {courses.map((course) => {
            const isPending = pendingCourseId === course.id;
            return (
              <article key={course.id} className="index-card">
                <div className="card-tab-bar">
                  <span className="card-tab-code">{course.code}</span>
                  {course.isFollowed ? (
                    <span className="status-chip">
                      {labels.courses.followingLabel}
                    </span>
                  ) : null}
                </div>

                <h2>{course.name}</h2>

                {course.description ? (
                  <p className="meta-text">{course.description}</p>
                ) : null}

                <div className="action-row">
                  <Link
                    to={`/courses/${course.id}`}
                    className="btn btn-secondary btn-compact"
                  >
                    {labels.courses.openWeeksCta}
                  </Link>

                  <button
                    type="button"
                    className="btn btn-secondary btn-compact btn-toggle"
                    aria-pressed={course.isFollowed}
                    disabled={isPending}
                    onClick={() => void toggleFollow(course.id, course.isFollowed)}
                  >
                    {course.isFollowed
                      ? labels.courses.followingLabel
                      : labels.courses.followCta}
                  </button>

                  {isRep ? (
                    <Link
                      to={`/manage?type=course&editId=${course.id}`}
                      className="btn btn-secondary btn-compact"
                    >
                      {labels.courses.editCourseCta}
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default CoursesPage;
