import React, { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { formatByteSize } from '../../domain/rules';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/StateViews';
import { Toast } from '../components/FigmaComponents';
import { useAuthSession } from '../hooks/useAuthSession';
import { useCourseDetail } from '../hooks/useCourseDetail';
import { labels } from '../i18n/labels';
import { formatDateTime, formatWeekCode } from '../utils/formatters';

export function CourseDetailPage(): React.ReactElement {
  const { courseId } = useParams<{ courseId: string }>();
  const location = useLocation();
  const { session } = useAuthSession();
  const userId = session?.user.id ?? null;
  const isRep = session?.user.role === 'rep';

  const [toastMessage, setToastMessage] = useState<string | null>(() => {
    return (location.state as { toast?: string } | null)?.toast ?? null;
  });

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

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

  useEffect(() => {
    const titlePrefix = courseWeeks?.course.name ?? labels.courseDetail.weeksHeading;
    document.title = `${titlePrefix} | ${labels.app.name}`;
  }, [courseWeeks?.course.name]);

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
      {toastMessage ? (
        <div style={{ position: 'fixed', top: 'var(--space-4)', right: 'var(--space-4)', zIndex: 200 }}>
          <Toast type="success" message={toastMessage} />
        </div>
      ) : null}

      <div className="breadcrumb-row">
        <Link to="/courses" className="breadcrumb-link">
          {labels.courseDetail.backToCourses}
        </Link>
      </div>

      <section className="index-card">
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
              {weeks.map((week) => {
                const hasContent =
                  week.materials.length > 0 || week.deadlines.length > 0;
                return (
                  <section key={week.id} className="index-card section-block">
                    <div className="card-tab-bar" style={{ marginBottom: 0 }}>
                      <span className="card-tab-code">
                        {formatWeekCode(
                          labels.courseDetail.weekTabPrefix,
                          week.weekNumber,
                        )}
                      </span>
                      {isRep ? (
                        <Link
                          to={`/manage?type=week&courseId=${course.id}&editId=${week.id}`}
                          className="btn btn-secondary btn-compact"
                        >
                          {labels.courseDetail.editWeekCta}
                        </Link>
                      ) : null}
                    </div>

                    <div>
                      <h2>{week.title}</h2>
                      {week.summary ? (
                        <p className="meta-text">{week.summary}</p>
                      ) : null}
                    </div>

                    {!hasContent ? (
                      <p className="meta-text">
                        {labels.courseDetail.emptyWeekContent}
                      </p>
                    ) : null}

                    {week.materials.length > 0 ? (
                      <div className="week-subsection">
                        <h3>{labels.courseDetail.materialsSubheading}</h3>
                        <ul className="item-list">
                          {week.materials.map((material) => (
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
                                    <span className="card-tab-code">
                                      {`[${labels.courseDetail.pdfBadgePrefix} ${formatByteSize(material.attachment.sizeBytes)}]`}
                                    </span>
                                  ) : null}
                                  {material.externalUrl ? (
                                    <span className="status-chip">
                                      {`[${labels.courseDetail.externalLinkBadge}]`}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              {material.description ? (
                                <p
                                  className="meta-text"
                                  style={{ margin: 0 }}
                                >
                                  {material.description.length > 120
                                    ? `${material.description.slice(0, 120)}...`
                                    : material.description}
                                </p>
                              ) : null}
                              {isRep ? (
                                <div
                                  className="action-row"
                                  style={{ marginTop: 0 }}
                                >
                                  <Link
                                    to={`/manage?type=material&courseId=${course.id}&editId=${material.id}`}
                                    className="btn btn-secondary btn-compact"
                                  >
                                    {labels.common.edit}
                                  </Link>
                                </div>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {week.deadlines.length > 0 ? (
                      <div className="week-subsection">
                        <h3>{labels.courseDetail.weekDeadlinesSubheading}</h3>
                        <ul className="item-list">
                          {week.deadlines.map((deadline) => {
                            const isUrgent =
                              deadline.isOverdue || deadline.isDueSoon;
                            const statusText = deadline.isOverdue
                              ? labels.home.statusOverdue
                              : deadline.isDueSoon
                                ? labels.home.statusDueSoon
                                : labels.home.statusScheduled;

                            return (
                              <li
                                key={deadline.id}
                                className={
                                  isUrgent
                                    ? 'item-row item-row--urgent'
                                    : 'item-row'
                                }
                              >
                                <div className="item-row__header">
                                  <strong>{deadline.title}</strong>
                                  <span
                                    className={
                                      isUrgent
                                        ? 'status-chip status-chip--urgent'
                                        : 'status-chip'
                                    }
                                  >
                                    <span
                                      className={
                                        isUrgent
                                          ? 'status-indicator-dot'
                                          : 'status-indicator-square'
                                      }
                                      aria-hidden="true"
                                    />
                                    {statusText}
                                  </span>
                                </div>
                                <p className="meta-text">
                                  {`${labels.home.duePrefix} ${formatDateTime(deadline.dueAt)}`}
                                </p>
                                {deadline.description ? (
                                  <p style={{ margin: 0 }}>
                                    {deadline.description}
                                  </p>
                                ) : null}
                                {isRep ? (
                                  <div
                                    className="action-row"
                                    style={{ marginTop: 0 }}
                                  >
                                    <Link
                                      to={`/manage?type=deadline&courseId=${course.id}&editId=${deadline.id}`}
                                      className="btn btn-secondary btn-compact"
                                    >
                                      {labels.common.edit}
                                    </Link>
                                  </div>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>
          )}

          {unassignedDeadlines.length > 0 ? (
            <section className="index-card section-block">
              <div className="card-tab-bar" style={{ marginBottom: 0 }}>
                <span className="card-tab-code">[DEADLINES]</span>
              </div>
              <h2>{labels.courseDetail.courseDeadlinesHeading}</h2>
              <ul className="item-list">
                {unassignedDeadlines.map((deadline) => {
                  const isUrgent = deadline.isOverdue || deadline.isDueSoon;
                  const statusText = deadline.isOverdue
                    ? labels.home.statusOverdue
                    : deadline.isDueSoon
                      ? labels.home.statusDueSoon
                      : labels.home.statusScheduled;

                  return (
                    <li
                      key={deadline.id}
                      className={
                        isUrgent
                          ? 'index-card index-card--urgent'
                          : 'item-row'
                      }
                    >
                      <div className="item-row__header">
                        <h3>{deadline.title}</h3>
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
                      <p className="meta-text">
                        {`${labels.home.duePrefix} ${formatDateTime(deadline.dueAt)}`}
                      </p>
                      {deadline.description ? (
                        <p style={{ margin: 0 }}>{deadline.description}</p>
                      ) : null}
                      {isRep ? (
                        <div className="action-row" style={{ marginTop: 0 }}>
                          <Link
                            to={`/manage?type=deadline&courseId=${course.id}&editId=${deadline.id}`}
                            className="btn btn-secondary btn-compact"
                          >
                            {labels.common.edit}
                          </Link>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <section className="index-card section-block">
            <div className="card-tab-bar" style={{ marginBottom: 0 }}>
              <span className="card-tab-code">[ANNOUNCEMENTS]</span>
            </div>
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
                      <span className="meta-text">
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
