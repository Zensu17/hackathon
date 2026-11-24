import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { m } from 'motion/react';
import { toast } from 'sonner';
import { useAppContainer } from '../../app/di';
import { formatByteSize } from '../../domain/rules';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/StateViews';
import {
  Chip,
  CourseCard,
  DeadlineItem,
} from '../components/FigmaComponents';
import {
  IconAlertCircle,
  IconCalendarCheck,
  IconCheckCircle,
  IconClock,
  IconCloudCheck,
  IconCloudDownload,
  IconNote,
  IconPlus,
  IconRefresh,
  IconSearch,
} from '../components/Icons';
import { useAuthSession } from '../hooks/useAuthSession';
import { useCourses } from '../hooks/useCourses';
import { useHomeWorkspace } from '../hooks/useHomeWorkspace';
import { useUpcomingDeadlines } from '../hooks/useUpcomingDeadlines';
import { labels } from '../i18n/labels';
import { formatDateTime, formatRelativeDue } from '../utils/formatters';
import { openOfflinePdfBlob } from '../utils/openOfflinePdf';

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) {
    return labels.home.greetingMorning;
  }
  if (hour < 18) {
    return labels.home.greetingAfternoon;
  }
  return labels.home.greetingEvening;
}

export function HomePage(): React.ReactElement {
  const container = useAppContainer();
  const { session } = useAuthSession();
  const userId = session?.user.id ?? null;
  const classId = session?.user.classId ?? null;
  const currentClass = session?.currentClass ?? null;
  const isRep = session?.user.role === 'rep';
  const firstName =
    session?.user.displayName.trim().split(/\s+/)[0] || labels.app.roleStudent;
  const [busyShelfId, setBusyShelfId] = useState<string | null>(null);

  const {
    result,
    completedIds,
    toggleCompleted,
    isLoading: deadlinesLoading,
    error: deadlinesError,
    reload: reloadDeadlines,
  } = useUpcomingDeadlines(userId);
  const {
    courses,
    isLoading: coursesLoading,
    error: coursesError,
    reload: reloadCourses,
    toggleFollow,
  } = useCourses(classId, userId);
  const {
    announcements,
    overview,
    studyShelf,
    isLoading: workspaceLoading,
    error: workspaceError,
    reload: reloadWorkspace,
  } = useHomeWorkspace(userId);

  useEffect(() => {
    document.title = `${labels.home.heading} | ${labels.app.name}`;
  }, []);

  const followedCount = result?.followedCourseCount ?? 0;
  const followedSummary =
    followedCount === 1
      ? `${labels.home.followedSummaryPrefix} ${labels.home.followedSummarySingular}`
      : `${labels.home.followedSummaryPrefix} ${followedCount} ${labels.home.followedSummaryPluralSuffix}`;

  const allItems = result?.items ?? [];
  const activeItems = allItems.filter((item) => !completedIds.has(item.id));
  const completedCount = allItems.length - activeItems.length;
  const urgentItems = activeItems.filter(
    (item) => item.isOverdue || item.isDueSoon,
  );

  const nextDeadline = urgentItems[0] ?? activeItems[0] ?? null;
  const remainingDeadlines = nextDeadline
    ? activeItems.filter((i) => i.id !== nextDeadline.id)
    : activeItems;

  const openQuickSearch = (): void => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
      );
    }
  };

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

  const handleShelfPdfAction = async (
    materialId: string,
    title: string,
    isAvailableOffline: boolean,
  ): Promise<void> => {
    if (isAvailableOffline) {
      try {
        const stored = await container.usecases.getOfflineMaterialFile.execute({
          materialId,
        });
        if (!stored) {
          toast.error(
            'Offline PDF was not found on this device. Download it again while online.',
          );
          await reloadWorkspace();
          return;
        }
        openOfflinePdfBlob(stored.bytes, stored.fileName);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Could not open offline PDF.',
        );
      }
      return;
    }

    setBusyShelfId(materialId);
    try {
      await container.usecases.downloadMaterialFile.execute({ materialId });
      await reloadWorkspace();
      toast.success(`Saved PDF offline: ${title}`);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Could not download PDF right now.',
      );
    } finally {
      setBusyShelfId(null);
    }
  };

  const followedCourses = courses.filter((c) => c.isFollowed);
  const displayCourses =
    followedCourses.length > 0 ? followedCourses : courses.slice(0, 3);

  const summaryByCourseId = new Map(
    (overview?.courses ?? []).map((entry) => [entry.courseId, entry]),
  );

  const totalPdfs = (overview?.courses ?? []).reduce(
    (sum, entry) => sum + entry.pdfCount,
    0,
  );
  const cachedPdfs = (overview?.courses ?? []).reduce(
    (sum, entry) => sum + entry.downloadedPdfCount,
    0,
  );

  const isLoading = deadlinesLoading || coursesLoading || workspaceLoading;
  const error = deadlinesError ?? coursesError ?? workspaceError;

  const handleToggleFollow = async (
    courseId: string,
    courseName: string,
    isFollowed: boolean,
  ): Promise<void> => {
    await toggleFollow(courseId, isFollowed);
    await Promise.all([reloadDeadlines(), reloadWorkspace()]);
    if (isFollowed) {
      toast.info(`Unfollowed ${courseName}`);
    } else {
      toast.success(`Following ${courseName}`);
    }
  };

  return (
    <div className="page-stack">
      {/* Compact Editorial Academic Study Masthead */}
      <header className="study-masthead">
        <div className="study-masthead__top">
          <div className="study-masthead__greeting">
            {currentClass ? (
              <span className="study-masthead__eyebrow">
                {`${currentClass.name} / ${currentClass.joinCode}`}
              </span>
            ) : null}
            <h1>{`${getTimeGreeting()}, ${firstName}`}</h1>
            {!isLoading && !error && result && followedCount > 0 ? (
              <p className="study-masthead__sub">{followedSummary}</p>
            ) : (
              <p className="study-masthead__sub">{labels.app.subtitle}</p>
            )}
          </div>

          <div className="study-masthead__actions">
            <button
              type="button"
              className="masthead-cta"
              onClick={openQuickSearch}
              aria-label={labels.home.searchAriaLabel}
            >
              <IconSearch size={15} />
              <span>Search workspace</span>
              <kbd className="masthead-kbd">Ctrl K</kbd>
            </button>
            {isRep ? (
              <Link to="/manage?type=deadline" className="masthead-cta">
                <IconPlus size={16} />
                <span>{labels.home.addDeadlineCta}</span>
              </Link>
            ) : null}
          </div>
        </div>

        {/* Real live study pulse counters from IndexedDB */}
        {!isLoading && !error ? (
          <div className="masthead-stats" aria-label="Workspace summary">
            <div className="masthead-stat">
              <span className="masthead-stat__value">{followedCount}</span>
              <span className="masthead-stat__label">
                {followedCount === 1 ? 'Followed course' : 'Followed courses'}
              </span>
            </div>
            <div className="masthead-stat">
              <span className="masthead-stat__value">{activeItems.length}</span>
              <span className="masthead-stat__label">
                {urgentItems.length > 0
                  ? `${urgentItems.length} urgent${completedCount > 0 ? ` / ${completedCount} done` : ` deadline${urgentItems.length === 1 ? '' : 's'}`}`
                  : completedCount > 0
                    ? `Active (${completedCount} done)`
                    : 'Active deadlines'}
              </span>
            </div>
            <div className="masthead-stat">
              <span className="masthead-stat__value">
                {totalPdfs > 0 ? `${cachedPdfs}/${totalPdfs}` : '0'}
              </span>
              <span className="masthead-stat__label">PDFs saved offline</span>
            </div>
          </div>
        ) : null}
      </header>

      {isLoading ? <LoadingState message={labels.home.loading} /> : null}

      {!isLoading && error ? (
        <ErrorState
          title={labels.home.errorTitle}
          detail={error}
          onRetry={() => {
            void reloadDeadlines();
            void reloadCourses();
            void reloadWorkspace();
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
          {/* Left Column: Next deadline spotlight, upcoming timeline, Study Shelf & Offline Readiness */}
          <div className="card-stack">
            {nextDeadline ? (
              <section className="section-block" aria-labelledby="next-deadline-heading">
                <div className="section-heading-row">
                  <h2 id="next-deadline-heading">Next deadline</h2>
                  <Link to="/deadlines" className="section-link">
                    All deadlines
                  </Link>
                </div>
                <article
                  className={
                    nextDeadline.isOverdue || nextDeadline.isDueSoon
                      ? 'index-card index-card--urgent'
                      : 'index-card'
                  }
                >
                  <div className="card-tab-bar">
                    <span className="card-tab-code">{nextDeadline.courseCode}</span>
                    <Chip
                      type={
                        nextDeadline.isOverdue
                          ? 'danger'
                          : nextDeadline.isDueSoon
                            ? 'warning'
                            : 'neutral'
                      }
                      size="S"
                      icon={
                        nextDeadline.isOverdue ? (
                          <IconAlertCircle size={14} />
                        ) : nextDeadline.isDueSoon ? (
                          <IconClock size={14} />
                        ) : (
                          <IconCalendarCheck size={14} />
                        )
                      }
                      label={
                        nextDeadline.isOverdue
                          ? labels.home.statusOverdue
                          : nextDeadline.isDueSoon
                            ? labels.home.statusDueSoon
                            : labels.home.statusScheduled
                      }
                    />
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', marginBottom: '4px' }}>
                    <Link to={`/courses/${nextDeadline.courseId}`} className="card-title-link" style={{ minHeight: 0, padding: 0 }}>
                      {nextDeadline.title}
                    </Link>
                  </h3>
                  <p className="meta-text">{nextDeadline.courseName}</p>

                  <div className="spotlight-due-strip">
                    <IconClock
                      size={16}
                      style={{
                        color: nextDeadline.isOverdue
                          ? 'var(--color-danger)'
                          : nextDeadline.isDueSoon
                            ? 'var(--color-warning)'
                            : 'var(--color-text-muted)',
                        flexShrink: 0,
                      }}
                    />
                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: nextDeadline.isOverdue
                          ? 'var(--color-danger)'
                          : 'var(--color-text)',
                      }}
                    >
                      {`${labels.home.duePrefix} ${formatDateTime(nextDeadline.dueAt)}`}
                    </span>
                    <span className="status-chip tabular-nums" style={{ marginLeft: 'auto' }}>
                      {formatRelativeDue(nextDeadline.dueAt)}
                    </span>
                  </div>

                  {nextDeadline.description ? (
                    <p style={{ marginTop: '12px', fontSize: '14px' }}>
                      {nextDeadline.description}
                    </p>
                  ) : null}
                  <div className="action-row" style={{ marginTop: '14px' }}>
                    <Link
                      to={`/courses/${nextDeadline.courseId}`}
                      className="figma-btn figma-btn--primary figma-btn--size-m"
                    >
                      View deadline
                    </Link>
                    <button
                      type="button"
                      className="figma-btn figma-btn--secondary figma-btn--size-m"
                      onClick={() =>
                        void handleToggleDeadline(
                          nextDeadline.id,
                          nextDeadline.title,
                        )
                      }
                    >
                      <IconCheckCircle size={15} />
                      <span>{labels.deadlines.markDoneCta}</span>
                    </button>
                  </div>
                </article>
              </section>
            ) : allItems.length > 0 ? (
              <section className="index-card section-block">
                <div className="card-tab-bar" style={{ marginBottom: 0 }}>
                  <span className="card-tab-code">CHECKLIST</span>
                  <Chip
                    type="success"
                    size="S"
                    icon={<IconCheckCircle size={14} />}
                    label={`${completedCount} completed`}
                  />
                </div>
                <h2>All followed deadlines completed</h2>
                <p className="meta-text">
                  Every deadline across your followed courses is marked done on this device. Open Deadlines to review or undo completed items.
                </p>
                <div className="action-row" style={{ marginTop: 0 }}>
                  <Link to="/deadlines" className="btn btn-secondary btn-compact">
                    Review completed deadlines
                  </Link>
                </div>
              </section>
            ) : null}

            {remainingDeadlines.length > 0 ? (
              <section className="section-block" aria-labelledby="upcoming-heading">
                <div className="section-heading-row">
                  <h2 id="upcoming-heading">Upcoming</h2>
                  <Link to="/deadlines" className="section-link">
                    See all
                  </Link>
                </div>
                <div className="index-card" style={{ paddingTop: '10px', paddingBottom: '10px' }}>
                  {remainingDeadlines.slice(0, 5).map((item) => (
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
                </div>
              </section>
            ) : null}

            {/* 1-Tap Study Shelf & Offline PDFs Quick-Resume */}
            {studyShelf.length > 0 ? (
              <section className="section-block" aria-labelledby="study-shelf-heading">
                <div className="section-heading-row">
                  <h2 id="study-shelf-heading">Study shelf &amp; offline PDFs</h2>
                  <Link to="/courses" className="section-link">
                    Browse all
                  </Link>
                </div>
                <div className="study-shelf-grid">
                  {studyShelf.map((item) => {
                    const isBusy = busyShelfId === item.id;
                    return (
                      <article key={item.id} className="study-shelf-card">
                        <div className="study-shelf-card__top">
                          <span className="card-tab-code">
                            {`${item.courseCode} / W${item.weekNumber}`}
                          </span>
                          {item.isAvailableOffline ? (
                            <Chip
                              type="success"
                              size="S"
                              icon={<IconCloudCheck size={12} />}
                              label="Offline"
                            />
                          ) : item.hasPdf ? (
                            <span className="meta-text tabular-nums" style={{ fontSize: '11px' }}>
                              {`PDF ${formatByteSize(item.pdfSizeBytes ?? 0)}`}
                            </span>
                          ) : (
                            <span className="meta-text" style={{ fontSize: '11px' }}>
                              Summary
                            </span>
                          )}
                        </div>

                        <h3 className="study-shelf-card__title">
                          <Link
                            to={`/materials/${item.id}`}
                            className="card-title-link"
                            style={{ minHeight: 0, padding: 0 }}
                          >
                            {item.title}
                          </Link>
                        </h3>

                        <div className="study-shelf-card__actions">
                          <Link
                            to={`/materials/${item.id}`}
                            className="btn btn-secondary btn-compact"
                          >
                            <IconNote size={13} />
                            <span>Notes</span>
                          </Link>
                          {item.hasPdf ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-compact"
                              disabled={isBusy}
                              onClick={() =>
                                void handleShelfPdfAction(
                                  item.id,
                                  item.title,
                                  item.isAvailableOffline,
                                )
                              }
                            >
                              {isBusy ? (
                                <IconRefresh size={13} className="anim-spin" />
                              ) : item.isAvailableOffline ? (
                                <IconCloudCheck
                                  size={13}
                                  style={{ color: 'var(--color-success)' }}
                                />
                              ) : (
                                <IconCloudDownload size={13} />
                              )}
                              <span>
                                {isBusy
                                  ? 'Saving...'
                                  : item.isAvailableOffline
                                    ? 'Open PDF'
                                    : 'Save PDF'}
                              </span>
                            </button>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {overview && overview.courses.length > 0 ? (
              <section className="section-block" aria-labelledby="offline-readiness-heading">
                <div className="section-heading-row">
                  <h2 id="offline-readiness-heading">
                    {labels.home.offlineReadinessHeading}
                  </h2>
                </div>
                <div className="index-card">
                  <div className="offline-readiness-list">
                    {overview.courses.map((entry) => {
                      const isComplete =
                        entry.materialCount > 0 &&
                        (entry.pdfCount === 0 ||
                          entry.downloadedPdfCount === entry.pdfCount);
                      const percent =
                        entry.materialCount === 0
                          ? 0
                          : entry.pdfCount === 0
                            ? 100
                            : Math.round(
                                (entry.downloadedPdfCount / entry.pdfCount) * 100,
                              );
                      return (
                        <div key={entry.courseId} className="offline-readiness-row">
                          <div className="offline-readiness-row__head">
                            <div>
                              <Link
                                to={`/courses/${entry.courseId}`}
                                className="card-title-link offline-readiness-row__title"
                              >
                                {`${entry.courseCode} - ${entry.courseName}`}
                              </Link>
                              <p className="meta-text tabular-nums">
                                {`${entry.weekCount} week${entry.weekCount === 1 ? '' : 's'}, ${entry.materialCount} material${entry.materialCount === 1 ? '' : 's'}`}
                              </p>
                            </div>
                            <Chip
                              type={isComplete ? 'success' : 'neutral'}
                              size="S"
                              icon={<IconCloudCheck size={14} />}
                              label={
                                entry.materialCount === 0
                                  ? 'No materials yet'
                                  : entry.pdfCount === 0
                                    ? 'Text ready offline'
                                    : `${entry.downloadedPdfCount}/${entry.pdfCount} PDFs offline`
                              }
                            />
                          </div>
                          <div
                            className="offline-meter"
                            role="progressbar"
                            aria-valuenow={percent}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${entry.courseName} offline cache ${percent}%`}
                          >
                            <m.div
                              className={
                                isComplete
                                  ? 'offline-meter__fill offline-meter__fill--complete'
                                  : 'offline-meter__fill'
                              }
                              initial={{ width: 0 }}
                              animate={{ width: `${percent}%` }}
                              transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            ) : null}
          </div>

          {/* Right Column: Followed courses and real IndexedDB announcements */}
          <div className="card-stack">
            <section className="section-block" aria-labelledby="courses-heading">
              <div className="section-heading-row">
                <h2 id="courses-heading">Your courses</h2>
                <Link to="/courses" className="section-link">
                  See all
                </Link>
              </div>
              <div className="card-stack">
                {displayCourses.map((c, idx) => {
                  const summary = summaryByCourseId.get(c.id);
                  const allPdfsCached =
                    summary !== undefined &&
                    summary.materialCount > 0 &&
                    (summary.pdfCount === 0 ||
                      summary.downloadedPdfCount === summary.pdfCount);
                  return (
                    <CourseCard
                      key={c.id}
                      courseId={c.id}
                      name={c.name}
                      code={c.code}
                      description={c.description}
                      accent={(((idx % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6)}
                      followed={c.isFollowed}
                      offlineReady={allPdfsCached}
                      weekCount={summary?.weekCount}
                      materialCount={summary?.materialCount}
                      pdfCount={summary?.pdfCount}
                      downloadedPdfCount={summary?.downloadedPdfCount}
                      onToggleFollow={() =>
                        void handleToggleFollow(c.id, c.name, c.isFollowed)
                      }
                    />
                  );
                })}
              </div>
            </section>

            <section className="section-block" aria-labelledby="announcements-heading">
              <div className="section-heading-row">
                <h2 id="announcements-heading">
                  {labels.home.latestAnnouncementsHeading}
                </h2>
              </div>
              <div className="index-card">
                {announcements.length === 0 ? (
                  <p className="meta-text" style={{ margin: 0 }}>
                    {labels.home.latestAnnouncementsEmpty}
                  </p>
                ) : (
                  <ul className="item-list">
                    {announcements.map((item) => (
                      <li key={item.announcement.id} className="item-row">
                        <div className="item-row__header">
                          <span className="card-tab-code">{item.courseCode}</span>
                          <span className="meta-text tabular-nums">
                            {formatDateTime(item.announcement.postedAt)}
                          </span>
                        </div>
                        <Link
                          to={`/courses/${item.announcement.courseId}`}
                          className="card-title-link"
                          style={{ minHeight: 0, padding: 0 }}
                        >
                          {item.announcement.title}
                        </Link>
                        <p className="meta-text" style={{ margin: 0 }}>
                          {item.announcement.body}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="meta-text" style={{ fontSize: 'var(--type-caption-size)' }}>
                {labels.home.savedOnDeviceFootnote}
              </p>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default HomePage;
