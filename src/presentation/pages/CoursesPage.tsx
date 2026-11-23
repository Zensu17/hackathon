import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/StateViews';
import { CourseCard, SegmentedControl } from '../components/FigmaComponents';
import { IconPlus } from '../components/Icons';
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
              className="figma-btn figma-btn--primary figma-btn--size-m"
            >
              <IconPlus size={16} />
              <span>{labels.courses.addCourseCta}</span>
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
          <div className="filter-tab-bar">
            <SegmentedControl<'all' | 'following'>
              options={['all', 'following']}
              active={filterMode}
              onChange={setFilterMode}
              labelsMap={{
                all: `${labels.courses.filterAll} (${courses.length})`,
                following: `${labels.courses.filterFollowing} (${followedCourses.length})`,
              }}
            />
          </div>

          {filterMode === 'following' && followedCourses.length === 0 ? (
            <EmptyState
              title={labels.courses.noFollowedFilterTitle}
              body={labels.courses.noFollowedFilterBody}
              actionLabel={labels.courses.filterAll}
              onAction={() => setFilterMode('all')}
            />
          ) : (
            <div className="courses-grid">
              {displayedCourses.map((course, idx) => {
                const isPending = pendingCourseId === course.id;
                const accent = (((idx % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6);
                return (
                  <CourseCard
                    key={course.id}
                    courseId={course.id}
                    name={course.name}
                    code={course.code}
                    description={course.description}
                    accent={accent}
                    followed={course.isFollowed}
                    toggleDisabled={isPending}
                    editTo={
                      isRep
                        ? `/manage?type=course&editId=${course.id}`
                        : undefined
                    }
                    onToggleFollow={() => {
                      void toggleFollow(course.id, course.isFollowed).then(() => {
                        if (course.isFollowed) {
                          toast.info(`Unfollowed ${course.name}`);
                        } else {
                          toast.success(`Following ${course.name}`);
                        }
                      });
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default CoursesPage;
