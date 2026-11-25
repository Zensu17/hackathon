import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useWorkspaceSearch } from '../hooks/useWorkspaceSearch';
import { labels } from '../i18n/labels';
import { formatDateTime } from '../utils/formatters';
import {
  IconBook,
  IconCalendarCheck,
  IconChevronRight,
  IconHome,
  IconNote,
  IconSearch,
  IconSettings,
  IconShield,
  IconUser,
} from './Icons';

export interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string | null;
  userId: string | null;
  isRep: boolean;
  isAdmin?: boolean;
}

interface QuickSearchFlatItem {
  id: string;
  category: string;
  badge: string;
  title: string;
  subtitle: string;
  to: string;
}

export function QuickSearchModal({
  isOpen,
  onClose,
  classId,
  userId,
  isRep,
  isAdmin = false,
}: QuickSearchModalProps): React.ReactElement | null {
  const navigate = useNavigate();
  const dialogTitleId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const { query, setQuery, clear, result, isSearching, error } =
    useWorkspaceSearch(classId, userId);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const quickNavItems = useMemo<QuickSearchFlatItem[]>(() => {
    const base: QuickSearchFlatItem[] = [
      {
        id: 'nav-home',
        category: 'Quick navigation',
        badge: 'SCREEN',
        title: 'Home workspace',
        subtitle: 'Upcoming deadlines, offline readiness, and announcements',
        to: '/',
      },
      {
        id: 'nav-courses',
        category: 'Quick navigation',
        badge: 'SCREEN',
        title: 'Class courses',
        subtitle: 'Browse and follow courses in your class',
        to: '/courses',
      },
      {
        id: 'nav-deadlines',
        category: 'Quick navigation',
        badge: 'SCREEN',
        title: 'Deadlines & checklist',
        subtitle: 'Filter upcoming tasks and mark completed work',
        to: '/deadlines',
      },
      {
        id: 'nav-profile',
        category: 'Quick navigation',
        badge: 'PROFILE',
        title: 'Customize profile',
        subtitle: 'Edit your display name, study program, bio, role, and avatar',
        to: '/profile',
      },
      {
        id: 'nav-settings',
        category: 'Quick navigation',
        badge: 'SCREEN',
        title: 'Settings & offline storage',
        subtitle: 'Appearance theme, Data Saver, and cached PDFs',
        to: '/settings',
      },
    ];
    if (isRep) {
      base.splice(3, 0, {
        id: 'nav-manage',
        category: 'Quick navigation',
        badge: 'MANAGE',
        title: 'Publish class update & members',
        subtitle: 'Add or edit courses, weeks, materials, deadlines, and announcements',
        to: '/manage',
      });
    }
    if (isAdmin) {
      base.splice(isRep ? 4 : 3, 0, {
        id: 'nav-admin-users',
        category: 'Quick navigation',
        badge: 'ADMIN',
        title: 'Manage all users & roles',
        subtitle: 'Assign Student, Lecturer, Assistant, Class Rep, and Admin roles across all classes',
        to: '/admin/users',
      });
    }
    return base;
  }, [isAdmin, isRep]);

  const flatItems = useMemo<QuickSearchFlatItem[]>(() => {
    if (query.trim().length === 0) {
      return quickNavItems;
    }
    if (!result) {
      return [];
    }

    const list: QuickSearchFlatItem[] = [];

    for (const course of result.courses) {
      list.push({
        id: `course-${course.id}`,
        category: 'Courses',
        badge: course.code,
        title: course.name,
        subtitle: course.description || 'Open weekly syllabus and materials',
        to: `/courses/${course.id}`,
      });
    }

    for (const hit of result.materials) {
      list.push({
        id: `material-${hit.material.id}`,
        category: 'Materials',
        badge: hit.courseCode,
        title: hit.material.title,
        subtitle: `${hit.weekNumber ? `Week ${hit.weekNumber}` : hit.courseName}${hit.material.isAvailableOffline ? ' / Saved offline' : ''}`,
        to: `/materials/${hit.material.id}`,
      });
    }

    for (const hit of result.deadlines) {
      list.push({
        id: `deadline-${hit.deadline.id}`,
        category: 'Deadlines',
        badge: hit.courseCode,
        title: hit.deadline.title,
        subtitle: `${labels.home.duePrefix} ${formatDateTime(hit.deadline.dueAt)}`,
        to: `/courses/${hit.deadline.courseId}`,
      });
    }

    for (const hit of result.announcements) {
      list.push({
        id: `announcement-${hit.announcement.id}`,
        category: 'Announcements',
        badge: hit.courseCode,
        title: hit.announcement.title,
        subtitle: hit.announcement.body,
        to: `/courses/${hit.announcement.courseId}`,
      });
    }

    return list;
  }, [query, quickNavItems, result]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, result]);

  useEffect(() => {
    if (isOpen) {
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        previousFocusRef.current = document.activeElement;
      }
      const focusTimer = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 20);
      return () => {
        window.clearTimeout(focusTimer);
      };
    }

    clear();
    if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
    return undefined;
  }, [clear, isOpen]);

  const handleSelect = (destination: string): void => {
    onClose();
    navigate(destination);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (flatItems.length > 0) {
        setActiveIndex((prev) => (prev + 1) % flatItems.length);
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (flatItems.length > 0) {
        setActiveIndex((prev) => (prev - 1 + flatItems.length) % flatItems.length);
      }
      return;
    }

    if (event.key === 'Enter' && flatItems.length > 0) {
      const target = flatItems[activeIndex] ?? flatItems[0];
      if (target) {
        event.preventDefault();
        handleSelect(target.to);
      }
      return;
    }

    if (event.key === 'Tab' && dialogRef.current) {
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'input, button, [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled'));

      if (focusable.length === 0) {
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  const renderCategoryIcon = (itemId: string, category: string): React.ReactNode => {
    if (itemId === 'nav-admin-users') return <IconShield size={16} />;
    if (itemId === 'nav-profile') return <IconUser size={16} />;
    if (category === 'Courses') return <IconBook size={16} />;
    if (category === 'Materials') return <IconNote size={16} />;
    if (category === 'Deadlines') return <IconCalendarCheck size={16} />;
    if (category === 'Quick navigation') return <IconHome size={16} />;
    return <IconSettings size={16} />;
  };

  return isOpen ? (
    <div
      className="quick-search-backdrop"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        className="quick-search-dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
            <h2 id={dialogTitleId} className="sr-only">
              Quick search offline workspace
            </h2>

            <div className="quick-search-dialog__header">
              <IconSearch
                size={18}
                style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}
              />
              <input
                ref={inputRef}
                id="quick-search-input"
                name="quickSearch"
                type="search"
                className="quick-search-dialog__input"
                placeholder={labels.home.searchPlaceholder}
                aria-label={labels.home.searchAriaLabel}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query.trim().length > 0 ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-compact"
                  onClick={() => {
                    clear();
                    inputRef.current?.focus();
                  }}
                >
                  {labels.home.searchClear}
                </button>
              ) : null}
              <button
                type="button"
                className="quick-search-dialog__esc"
                onClick={onClose}
                aria-label="Close quick search"
              >
                ESC
              </button>
            </div>

            <div className="quick-search-dialog__body" role="listbox" aria-label="Search results">
              {isSearching ? (
                <p className="quick-search-dialog__status">
                  Searching saved local records in IndexedDB...
                </p>
              ) : error ? (
                <p className="field-error" role="alert">
                  {error}
                </p>
              ) : query.trim().length > 0 && flatItems.length === 0 ? (
                <p className="quick-search-dialog__status">
                  {labels.home.searchNoResults}
                </p>
              ) : (
                <ul className="quick-search-dialog__list">
                  {flatItems.map((item, idx) => {
                    const isSelected = idx === activeIndex;
                    const prevCategory = idx > 0 ? flatItems[idx - 1]?.category : null;
                    const showCategoryHeader = item.category !== prevCategory;

                    return (
                      <React.Fragment key={item.id}>
                        {showCategoryHeader ? (
                          <li className="quick-search-dialog__group-label" aria-hidden="true">
                            {item.category}
                          </li>
                        ) : null}
                        <li>
                          <button
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            className={
                              isSelected
                                ? 'quick-search-item quick-search-item--active'
                                : 'quick-search-item'
                            }
                            onMouseEnter={() => setActiveIndex(idx)}
                            onClick={() => handleSelect(item.to)}
                          >
                            <span className="quick-search-item__icon" aria-hidden="true">
                              {renderCategoryIcon(item.id, item.category)}
                            </span>
                            <span className="quick-search-item__content">
                              <span className="quick-search-item__top">
                                <span className="card-tab-code">{item.badge}</span>
                                <span className="quick-search-item__title">{item.title}</span>
                              </span>
                              <span className="quick-search-item__sub">{item.subtitle}</span>
                            </span>
                            <IconChevronRight
                              size={16}
                              className="quick-search-item__arrow"
                            />
                          </button>
                        </li>
                      </React.Fragment>
                    );
                  })}
                </ul>
              )}
            </div>

            <footer className="quick-search-dialog__footer">
              <span>
                <kbd className="kbd-badge">Up</kbd>{' '}
                <kbd className="kbd-badge">Down</kbd> to navigate
              </span>
              <span>
                <kbd className="kbd-badge">Enter</kbd> to open
              </span>
              <span>
                <kbd className="kbd-badge">Esc</kbd> to close
              </span>
              <span className="quick-search-dialog__offline-tag">
                100% local IndexedDB
              </span>
            </footer>
      </div>
    </div>
  ) : null;
}
