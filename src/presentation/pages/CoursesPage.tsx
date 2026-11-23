import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/StateViews';
import { CourseCard, SegmentedControl } from '../components/FigmaComponents';
import { IconPlus, IconSearch } from '../components/Icons';
import { useAuthSession } from '../hooks/useAuthSession';
import { useCourses } from '../hooks/useCourses';
import { useHomeWorkspace } from '../hooks/useHomeWorkspace';
import { labels } from '../i18n/labels';

export function CoursesPage(): React.ReactElement {
  const { session } = useAuthSession();
  const classId = session?.user.classId ?? null;
  const userId = session?.user.id ?? null;
  const isRep = session?.user.role === 'rep';

  const [filterMode, setFilterMode] = useState<'all' | 'following'>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');

  const {
    courses,
    isLoading,
    error,
    pendingCourseId,
    reload,
    toggleFollow,
  } = useCourses(classId, userId);

  const { overview, reload: reloadOverview } = useHomeWorkspace(userId);

  useEffect(() => {
    document.title = `${labels.courses.heading} | ${labels.app.name}`;
  }, []);

  const summaryByCourseId = useMemo(
    () =>
      new Map(
        (overview?.courses ?? []).map((entry) => [entry.courseId, entry]),
      ),
    [overview],
  );

  const followedCourses = useMemo(
    () => courses.filter((course) => course.isFollowed),
    [courses],
  );

  const displayedCourses = useMemo(() => {
    const base = filterMode === 'following' ? followedCourses : courses;
    const needle = searchFilter.trim().toLowerCase();
    if (!needle) {
      return base;
    }
    return base.filter(
      (c) =>
        c.code.toLowerCase().includes(needle) ||
        c.name.toLowerCase().includes(needle) ||
        c.description.toLowerCase().includes(needle),
    );
  }, [courses, filterMode, followedCourses, searchFilter]);

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
          <div className="courses-toolbar">
            <div className="courses-toolbar__tabs">
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

            <div className="courses-filter-input-wrap">
              <IconSearch
                size={16}
                style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}
              />
              <input
                type="search"
                className="courses-filter-input"
                placeholder="Filter by course code or title..."
                aria-label="Filter courses by code or title"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </div>
          </div>

          {filterMode === 'following' && followedCourses.length === 0 ? (
            <EmptyState
              title={labels.courses.noFollowedFilterTitle}
              body={labels.courses.noFollowedFilterBody}
              actionLabel={labels.courses.filterAll}
              onAction={() => setFilterMode('all')}
            />
          ) : displayedCourses.length === 0 ? (
            <EmptyState
              title="No courses match that filter"
              body="Try a shorter course code or clear the filter input."
              actionLabel="Clear filter"
              onAction={() => setSearchFilter('')}
            />
          ) : (
            <div className="courses-grid">
              {displayedCourses.map((course, idx) => {
                const isPending = pendingCourseId === course.id;
                const accent = (((idx % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6);
                const summary = summaryByCourseId.get(course.id);
                const allPdfsCached =
                  summary !== undefined &&
                  summary.materialCount > 0 &&
                  (summary.pdfCount === 0 ||
                    summary.downloadedPdfCount === summary.pdfCount);

                return (
                  <CourseCard
                    key={course.id}
                    courseId={course.id}
                    name={course.name}
                    code={course.code}
                    description={course.description}
                    accent={accent}
                    followed={course.isFollowed}
                    offlineReady={allPdfsCached}
                    weekCount={summary?.weekCount}
                    materialCount={summary?.materialCount}
                    pdfCount={summary?.pdfCount}
                    downloadedPdfCount={summary?.downloadedPdfCount}
                    toggleDisabled={isPending}
                    editTo={
                      isRep
                        ? `/manage?type=course&editId=${course.id}`
                        : undefined
                    }
                    onToggleFollow={() => {
                      void toggleFollow(course.id, course.isFollowed).then(
                        async () => {
                          await reloadOverview();
                          if (course.isFollowed) {
                            toast.info(`Unfollowed ${course.name}`);
                          } else {
                            toast.success(`Following ${course.name}`);
                          }
                        },
                      );
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
