import React, { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { toast } from 'sonner';
import { useAppContainer } from '../../app/di';
import { canManageClassContent, formatByteSize } from '../../domain/rules';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/StateViews';
import { DeadlineItem, WeekSection } from '../components/FigmaComponents';
import {
  IconArrowLeft,
  IconCloudCheck,
  IconCloudDownload,
  IconPlus,
  IconRefresh,
} from '../components/Icons';
import { useAuthSession } from '../hooks/useAuthSession';
import { useCourseDetail } from '../hooks/useCourseDetail';
import { useUpcomingDeadlines } from '../hooks/useUpcomingDeadlines';
import { labels } from '../i18n/labels';
import {
  formatDateTime,
  formatRelativeDue,
  formatWeekCode,
} from '../utils/formatters';
import { openOfflinePdfBlob } from '../utils/openOfflinePdf';

export function CourseDetailPage(): React.ReactElement {
  const { courseId } = useParams<{ courseId: string }>();
  const location = useLocation();
  const container = useAppContainer();
  const { session } = useAuthSession();
  const userId = session?.user.id ?? null;
  const isRep = canManageClassContent(session?.user.role);
  const [expandedWeekIds, setExpandedWeekIds] = useState<string[]>([]);
  const [busyMaterialId, setBusyMaterialId] = useState<string | null>(null);

  const navToast = (location.state as { toast?: string } | null)?.toast ?? null;

  useEffect(() => {
    if (navToast) {
      toast.success(navToast, { id: 'course-detail-nav-toast' });
    }
  }, [navToast]);

  const {
    courseWeeks,
    announcements,
    isLoading,
    isNotFound,
    error,
    isTogglingFollow,
    reload,
    toggleFollow,
  } = useCourseDetail(courseId, userId);

  const { completedIds, toggleCompleted } = useUpcomingDeadlines(userId);

  const latestWeekId =
    courseWeeks && courseWeeks.weeks.length > 0
      ? courseWeeks.weeks[courseWeeks.weeks.length - 1]!.id
      : null;

  useEffect(() => {
    setExpandedWeekIds(latestWeekId ? [latestWeekId] : []);
  }, [courseId, latestWeekId]);

  useEffect(() => {
    const titlePrefix = courseWeeks?.course.name ?? labels.courseDetail.weeksHeading;
    document.title = `${titlePrefix} | ${labels.app.name}`;
  }, [courseWeeks?.course.name]);

  const handleInlineDownloadPdf = async (
    materialId: string,
    title: string,
  ): Promise<void> => {
    setBusyMaterialId(materialId);
    try {
      await container.usecases.downloadMaterialFile.execute({ materialId });
      await reload();
      toast.success(`Saved PDF offline: ${title}`);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Could not download PDF right now.',
      );
    } finally {
      setBusyMaterialId(null);
    }
  };

  const handleInlineOpenOfflinePdf = async (
    materialId: string,
  ): Promise<void> => {
    try {
      const stored = await container.usecases.getOfflineMaterialFile.execute({
        materialId,
      });
      if (!stored) {
        toast.error(
          'Offline PDF was not found on this device. Download it again while online.',
        );
        await reload();
        return;
      }
      openOfflinePdfBlob(stored.bytes, stored.fileName);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not open offline PDF.',
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

  if (isLoading) {
    return (
      <div className="page-stack">
        <div className="breadcrumb-row">
          <Link to="/courses" className="breadcrumb-link">
            {labels.courseDetail.backToCourses}
          </Link>
        </div>
        <h1>{labels.courseDetail.weeksHeading}</h1>
        <LoadingState message={labels.courseDetail.loading} />
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="page-stack">
        <div className="breadcrumb-row">
          <Link to="/courses" className="breadcrumb-link">
            {labels.courseDetail.backToCourses}
          </Link>
        </div>
        <h1>{labels.courseDetail.notFoundTitle}</h1>
        <EmptyState
          title={labels.courseDetail.notFoundTitle}
          body={labels.courseDetail.notFoundBody}
          actionLabel={labels.courseDetail.backToCourses}
          actionTo="/courses"
        />
      </div>
    );
  }

  if (error || !courseWeeks) {
    return (
      <div className="page-stack">
        <div className="breadcrumb-row">
          <Link to="/courses" className="breadcrumb-link">
            {labels.courseDetail.backToCourses}
          </Link>
        </div>
        <h1>{labels.courseDetail.errorTitle}</h1>
        <ErrorState
          title={labels.courseDetail.errorTitle}
          detail={error ?? undefined}
          onRetry={() => void reload()}
        />
      </div>
    );
  }

  const { course, isFollowed, weeks, unassignedDeadlines } = courseWeeks;

  return (
    <div className="page-stack">
      <div className="breadcrumb-row">
        <Link to="/courses" className="breadcrumb-link">
          <IconArrowLeft size={15} />
          <span>{labels.courseDetail.backToCourses}</span>
        </Link>
      </div>

      <section className="index-card course-hero">
        <div className="card-tab-bar">
          <span className="card-tab-code">{course.code}</span>
          {isFollowed ? (
            <span className="status-chip status-chip--active">
              <span className="status-indicator-dot" aria-hidden="true" />
              {labels.courses.followingLabel}
            </span>
          ) : null}
        </div>

        <h1>{course.name}</h1>

        {course.description ? (
          <p className="page-lead">{course.description}</p>
        ) : null}

        <div className="course-hero__stats">
          <span className="status-chip tabular-nums">
            {`${weeks.length} week${weeks.length === 1 ? '' : 's'}`}
          </span>
          <span className="status-chip tabular-nums">
            {`${weeks.reduce((sum, w) => sum + w.materials.length, 0)} material${weeks.reduce((sum, w) => sum + w.materials.length, 0) === 1 ? '' : 's'}`}
          </span>
          <span className="status-chip tabular-nums">
            {`${weeks.reduce((sum, w) => sum + w.deadlines.length, 0) + unassignedDeadlines.length} deadline${weeks.reduce((sum, w) => sum + w.deadlines.length, 0) + unassignedDeadlines.length === 1 ? '' : 's'}`}
          </span>
        </div>

        <div className="action-row">
          <button
            type="button"
            className="btn btn-secondary btn-compact btn-toggle"
            aria-pressed={isFollowed}
            disabled={isTogglingFollow}
            onClick={() => void toggleFollow()}
          >
            {isFollowed ? labels.courses.followingLabel : labels.courses.followCta}
          </button>

          {isRep ? (
            <>
              <Link
                to={`/manage?type=course&editId=${course.id}`}
                className="btn btn-secondary btn-compact"
              >
                {labels.courseDetail.editCourseCta}
              </Link>
              <Link
                to={`/manage?type=week&courseId=${course.id}`}
                className="btn btn-secondary btn-compact"
              >
                {labels.courseDetail.addWeekCta}
              </Link>
              <Link
                to={`/manage?type=material&courseId=${course.id}`}
                className="btn btn-secondary btn-compact"
              >
                {labels.courseDetail.addMaterialCta}
              </Link>
              <Link
                to={`/manage?type=deadline&courseId=${course.id}`}
                className="btn btn-secondary btn-compact"
              >
                {labels.courseDetail.addDeadlineCta}
              </Link>
              <Link
                to={`/manage?type=announcement&courseId=${course.id}`}
                className="btn btn-secondary btn-compact"
              >
                {labels.courseDetail.postAnnouncementCta}
              </Link>
            </>
          ) : null}
        </div>
      </section>

      {!isFollowed ? (
        <EmptyState
          title={labels.courseDetail.emptyUnfollowedTitle}
          body={labels.courseDetail.emptyUnfollowedBody}
          actionLabel={labels.courses.followCta}
          onAction={() => void toggleFollow()}
          actionDisabled={isTogglingFollow}
        />
      ) : (
        <>
          {weeks.length === 0 ? (
            <EmptyState
              title={labels.courseDetail.emptyNoWeeksTitle}
              body={
                isRep
                  ? labels.courseDetail.emptyNoWeeksBodyRep
                  : labels.courseDetail.emptyNoWeeksBodyStudent
              }
              actionLabel={
                isRep ? labels.courseDetail.addFirstWeekCta : undefined
              }
              actionTo={
                isRep ? `/manage?type=week&courseId=${course.id}` : undefined
              }
            />
          ) : (
            <div className="card-stack">
              <div className="section-heading-row">
                <h2>{labels.courseDetail.weeksHeading}</h2>
                {weeks.length > 1 ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-compact"
                    onClick={() => {
                      const allExpanded = weeks.every((w) =>
                        expandedWeekIds.includes(w.id),
                      );
                      setExpandedWeekIds(
                        allExpanded ? [] : weeks.map((w) => w.id),
                      );
                    }}
                  >
                    {weeks.every((w) => expandedWeekIds.includes(w.id))
                      ? labels.courseDetail.collapseAllWeeks
                      : labels.courseDetail.expandAllWeeks}
                  </button>
                ) : null}
              </div>

              {weeks.map((week) => {
                const hasContent =
                  week.materials.length > 0 || week.deadlines.length > 0;
                const isExpanded = expandedWeekIds.includes(week.id);
                const isLatestWeek = week.id === latestWeekId;
                const matCount = week.materials.length;
                const dlCount = week.deadlines.length;
                const weekMeta = `${matCount} material${matCount === 1 ? '' : 's'} / ${dlCount} deadline${dlCount === 1 ? '' : 's'}`;

                return (
                  <WeekSection
                    key={week.id}
                    code={formatWeekCode(
                      labels.courseDetail.weekTabPrefix,
                      week.weekNumber,
                    )}
                    title={week.title}
                    meta={weekMeta}
                    thisWeek={isLatestWeek}
                    expanded={isExpanded}
                    onToggle={() => {
                      setExpandedWeekIds((prev) =>
                        prev.includes(week.id)
                          ? prev.filter((id) => id !== week.id)
                          : [...prev, week.id],
                      );
                    }}
                  >
                    {week.summary || isRep ? (
                      <div className="item-row__header">
                        {week.summary ? (
                          <p className="meta-text" style={{ margin: 0 }}>
                            {week.summary}
                          </p>
                        ) : (
                          <span />
                        )}
                        {isRep ? (
                          <Link
                            to={`/manage?type=week&courseId=${course.id}&editId=${week.id}`}
                            className="btn btn-secondary btn-compact"
                          >
                            {labels.courseDetail.editWeekCta}
                          </Link>
                        ) : null}
                      </div>
                    ) : null}

                    {!hasContent ? (
                      <p className="meta-text">
                        {labels.courseDetail.emptyWeekContent}
                      </p>
                    ) : null}

                    {week.materials.length > 0 ? (
                      <div className="week-subsection">
                        <h3>{labels.courseDetail.materialsSubheading}</h3>
                        <ul className="item-list">
                          {week.materials.map((material) => {
                            const isBusy = busyMaterialId === material.id;
                            return (
                              <li key={material.id} className="item-row">
                                <div className="item-row__header">
                                  <Link
                                    to={`/materials/${material.id}`}
                                    className="card-title-link"
                                  >
                                    {material.title}
                                  </Link>
                                  <div className="breadcrumb-row">
                                    {material.attachment ? (
                                      material.isAvailableOffline ? (
                                        <button
                                          type="button"
                                          className="btn btn-secondary btn-compact"
                                          onClick={() =>
                                            void handleInlineOpenOfflinePdf(
                                              material.id,
                                            )
                                          }
                                        >
                                          <IconCloudCheck
                                            size={14}
                                            style={{ color: 'var(--color-success)' }}
                                          />
                                          <span>
                                            {`Open PDF (${formatByteSize(material.attachment.sizeBytes)})`}
                                          </span>
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          className="btn btn-secondary btn-compact"
                                          disabled={isBusy}
                                          onClick={() =>
                                            void handleInlineDownloadPdf(
                                              material.id,
                                              material.title,
                                            )
                                          }
                                        >
                                          {isBusy ? (
                                            <IconRefresh
                                              size={14}
                                              className="anim-spin"
                                            />
                                          ) : (
                                            <IconCloudDownload size={14} />
                                          )}
                                          <span>
                                            {isBusy
                                              ? 'Saving...'
                                              : `Download PDF (${formatByteSize(material.attachment.sizeBytes)})`}
                                          </span>
                                        </button>
                                      )
                                    ) : null}
                                    {material.externalUrl ? (
                                      <span className="status-chip">
                                        {labels.courseDetail.externalLinkBadge}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                                {material.description ? (
                                  <p
                                    className="meta-text"
                                    style={{ margin: 0 }}
                                  >
                                    {material.description.length > 140
                                      ? `${material.description.slice(0, 140)}...`
                                      : material.description}
                                  </p>
                                ) : null}
                                <div
                                  className="action-row"
                                  style={{ marginTop: 0 }}
                                >
                                  <Link
                                    to={`/materials/${material.id}`}
                                    className="section-link"
                                    style={{ minHeight: '34px', padding: '0 8px' }}
                                  >
                                    Read &amp; take notes
                                  </Link>
                                  {isRep ? (
                                    <Link
                                      to={`/manage?type=material&courseId=${course.id}&editId=${material.id}`}
                                      className="btn btn-secondary btn-compact"
                                    >
                                      {labels.common.edit}
                                    </Link>
                                  ) : null}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}

                    {week.deadlines.length > 0 ? (
                      <div className="week-subsection">
                        <h3>{labels.courseDetail.weekDeadlinesSubheading}</h3>
                        <div>
                          {week.deadlines.map((deadline) => (
                            <div key={deadline.id}>
                              <DeadlineItem
                                title={deadline.title}
                                course={
                                  deadline.description ||
                                  `${course.code} - Week ${week.weekNumber}`
                                }
                                dueText={formatDateTime(deadline.dueAt)}
                                relativeText={formatRelativeDue(deadline.dueAt)}
                                urgency={
                                  deadline.isOverdue
                                    ? 'overdue'
                                    : deadline.isDueSoon
                                      ? 'due soon'
                                      : 'normal'
                                }
                                completed={completedIds.has(deadline.id)}
                                onToggleComplete={() =>
                                  void handleToggleDeadline(
                                    deadline.id,
                                    deadline.title,
                                  )
                                }
                              />
                              {isRep ? (
                                <div
                                  className="action-row"
                                  style={{ marginTop: '4px', marginBottom: '8px' }}
                                >
                                  <Link
                                    to={`/manage?type=deadline&courseId=${course.id}&editId=${deadline.id}`}
                                    className="btn btn-secondary btn-compact"
                                  >
                                    {labels.common.edit}
                                  </Link>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {isRep ? (
                      <div className="week-rep-bar">
                        <Link
                          to={`/manage?type=material&courseId=${course.id}&weekId=${week.id}`}
                          className="btn btn-secondary btn-compact"
                        >
                          <IconPlus size={14} />
                          <span>{`Add material to Week ${week.weekNumber}`}</span>
                        </Link>
                        <Link
                          to={`/manage?type=deadline&courseId=${course.id}&weekId=${week.id}`}
                          className="btn btn-secondary btn-compact"
                        >
                          <IconPlus size={14} />
                          <span>{`Add deadline to Week ${week.weekNumber}`}</span>
                        </Link>
                      </div>
                    ) : null}
                  </WeekSection>
                );
              })}
            </div>
          )}

          {unassignedDeadlines.length > 0 ? (
            <section className="index-card section-block">
              <h2>{labels.courseDetail.courseDeadlinesHeading}</h2>
              <div>
                {unassignedDeadlines.map((deadline) => (
                  <div key={deadline.id}>
                    <DeadlineItem
                      title={deadline.title}
                      course={deadline.description || course.name}
                      dueText={formatDateTime(deadline.dueAt)}
                      relativeText={formatRelativeDue(deadline.dueAt)}
                      urgency={
                        deadline.isOverdue
                          ? 'overdue'
                          : deadline.isDueSoon
                            ? 'due soon'
                            : 'normal'
                      }
                      completed={completedIds.has(deadline.id)}
                      onToggleComplete={() =>
                        void handleToggleDeadline(deadline.id, deadline.title)
                      }
                    />
                    {isRep ? (
                      <div
                        className="action-row"
                        style={{ marginTop: '4px', marginBottom: '8px' }}
                      >
                        <Link
                          to={`/manage?type=deadline&courseId=${course.id}&editId=${deadline.id}`}
                          className="btn btn-secondary btn-compact"
                        >
                          {labels.common.edit}
                        </Link>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="index-card section-block">
            <h2>{labels.courseDetail.announcementsHeading}</h2>
            {announcements.length === 0 ? (
              <p className="meta-text">
                {labels.courseDetail.emptyAnnouncements}
              </p>
            ) : (
              <ul className="item-list">
                {announcements.map((ann) => (
                  <li key={ann.id} className="item-row">
                    <div className="item-row__header">
                      <h3>{ann.title}</h3>
                      <span className="meta-text tabular-nums">
                        {`${labels.courseDetail.postedPrefix} ${formatDateTime(ann.postedAt)}`}
                      </span>
                    </div>
                    <p className="material-body" style={{ margin: 0 }}>
                      {ann.body}
                    </p>
                    {isRep ? (
                      <div className="action-row" style={{ marginTop: 0 }}>
                        <Link
                          to={`/manage?type=announcement&courseId=${course.id}&editId=${ann.id}`}
                          className="btn btn-secondary btn-compact"
                        >
                          {labels.common.edit}
                        </Link>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default CourseDetailPage;
