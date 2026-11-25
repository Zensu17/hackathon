import React from 'react';
import { Link } from 'react-router';
import {
  IconBook,
  IconCalendarCheck,
  IconCheckCircle,
  IconChevronRight,
  IconCloudDownload,
  IconNote,
  IconUsers,
} from './Icons';

const GUIDE_DISMISSED_KEY = 'litelearn_guide_dismissed';

export function isQuickGuideDismissed(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    return window.localStorage.getItem(GUIDE_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setQuickGuideDismissed(hidden: boolean): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    if (hidden) {
      window.localStorage.setItem(GUIDE_DISMISSED_KEY, 'true');
    } else {
      window.localStorage.removeItem(GUIDE_DISMISSED_KEY);
    }
  } catch {
    // Ignore storage errors in restricted environments.
  }
}

export interface QuickStartGuideProps {
  followedCount: number;
  activeDeadlineCount: number;
  cachedPdfCount: number;
  totalPdfCount: number;
  isRep: boolean;
  isAdmin?: boolean;
  firstCourseId?: string;
  onDismiss: () => void;
}

export function QuickStartGuide({
  followedCount,
  activeDeadlineCount,
  cachedPdfCount,
  totalPdfCount,
  isRep,
  isAdmin = false,
  firstCourseId,
  onDismiss,
}: QuickStartGuideProps): React.ReactElement {
  const coursesDone = followedCount > 0;
  const pdfDone = cachedPdfCount > 0;
  const pdfTarget = firstCourseId ? `/courses/${firstCourseId}` : '/courses';

  return (
    <section
      className="quick-guide-card"
      aria-labelledby="quick-guide-heading"
    >
      <div className="quick-guide-card__head">
        <div>
          <h2 id="quick-guide-heading" className="quick-guide-card__title">
            How to use this workspace
          </h2>
          <p className="meta-text">
            Follow these steps to keep your study materials ready offline. You can show this guide again anytime from Settings.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-compact"
          onClick={onDismiss}
        >
          Hide guide
        </button>
      </div>

      <ul
        className={
          isRep ? 'quick-guide-list quick-guide-list--four' : 'quick-guide-list'
        }
      >
        <li
          className={
            coursesDone
              ? 'quick-guide-step quick-guide-step--done'
              : 'quick-guide-step'
          }
        >
          <div className="quick-guide-step__top">
            <span className="quick-guide-step__icon" aria-hidden="true">
              {coursesDone ? (
                <IconCheckCircle size={20} />
              ) : (
                <IconBook size={20} />
              )}
            </span>
            <div>
              <h3 className="quick-guide-step__title">
                Follow your semester courses
              </h3>
              <p className="quick-guide-step__desc">
                {coursesDone
                  ? `You are following ${followedCount} course${followedCount === 1 ? '' : 's'} on this device.`
                  : 'Open Courses and toggle Follow on the classes you take so weekly outlines save locally.'}
              </p>
            </div>
          </div>
          <Link to="/courses" className="quick-guide-step__link">
            <span>{coursesDone ? 'Manage followed courses' : 'Choose courses'}</span>
            <IconChevronRight size={16} />
          </Link>
        </li>

        <li className="quick-guide-step">
          <div className="quick-guide-step__top">
            <span className="quick-guide-step__icon" aria-hidden="true">
              <IconCalendarCheck size={20} />
            </span>
            <div>
              <h3 className="quick-guide-step__title">
                Track &amp; check off deadlines
              </h3>
              <p className="quick-guide-step__desc">
                {activeDeadlineCount > 0
                  ? `${activeDeadlineCount} active deadline${activeDeadlineCount === 1 ? '' : 's'} waiting. Tap Mark done when you submit.`
                  : 'Open Deadlines to filter this week, overdue tasks, or completed items.'}
              </p>
            </div>
          </div>
          <Link to="/deadlines" className="quick-guide-step__link">
            <span>Open deadlines</span>
            <IconChevronRight size={16} />
          </Link>
        </li>

        <li
          className={
            pdfDone
              ? 'quick-guide-step quick-guide-step--done'
              : 'quick-guide-step'
          }
        >
          <div className="quick-guide-step__top">
            <span className="quick-guide-step__icon" aria-hidden="true">
              {pdfDone ? (
                <IconCheckCircle size={20} />
              ) : (
                <IconCloudDownload size={20} />
              )}
            </span>
            <div>
              <h3 className="quick-guide-step__title">
                Save PDFs for offline reading
              </h3>
              <p className="quick-guide-step__desc">
                {totalPdfCount > 0
                  ? `${cachedPdfCount} of ${totalPdfCount} course PDF${totalPdfCount === 1 ? '' : 's'} saved on this device. Data Saver skips auto-downloads.`
                  : 'Open any course week to download lecture PDFs and save personal notes offline.'}
              </p>
            </div>
          </div>
          <Link to={pdfTarget} className="quick-guide-step__link">
            <span>{firstCourseId ? 'Open course materials' : 'Browse courses'}</span>
            <IconChevronRight size={16} />
          </Link>
        </li>

        {isAdmin ? (
          <li className="quick-guide-step">
            <div className="quick-guide-step__top">
              <span className="quick-guide-step__icon" aria-hidden="true">
                <IconUsers size={20} />
              </span>
              <div>
                <h3 className="quick-guide-step__title">
                  Assign user roles &amp; classes
                </h3>
                <p className="quick-guide-step__desc">
                  New accounts start as Student. Open Admin Users to promote Lecturers, Teaching Assistants, Class Reps, or Admins.
                </p>
              </div>
            </div>
            <Link to="/admin/users" className="quick-guide-step__link">
              <span>Open Admin Users</span>
              <IconChevronRight size={16} />
            </Link>
          </li>
        ) : isRep ? (
          <li className="quick-guide-step">
            <div className="quick-guide-step__top">
              <span className="quick-guide-step__icon" aria-hidden="true">
                <IconNote size={20} />
              </span>
              <div>
                <h3 className="quick-guide-step__title">
                  Publish class updates
                </h3>
                <p className="quick-guide-step__desc">
                  As a Class Rep, Lecturer, Assistant, or Admin, add courses, weekly outlines, PDFs, and announcements in Manage.
                </p>
              </div>
            </div>
            <Link to="/manage" className="quick-guide-step__link">
              <span>Open Manage studio</span>
              <IconChevronRight size={16} />
            </Link>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
