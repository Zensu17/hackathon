import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useAuthSession } from '../hooks/useAuthSession';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useTheme } from '../hooks/useTheme';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { labels } from '../i18n/labels';
import {
  BrandMark,
  IconBook,
  IconCalendarCheck,
  IconHome,
  IconLogout,
  IconMoon,
  IconNote,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconSun,
  IconWifiOff,
} from './Icons';
import { NetworkStatus } from './FigmaComponents';
import { QuickSearchModal } from './QuickSearchModal';
import { formatDateTime, getInitials } from '../utils/formatters';
import './AppLayout.css';

function ThemeQuickSwitch({ compact = false }: { compact?: boolean }): React.ReactElement {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className="btn btn-secondary app-theme-btn"
      onClick={() => {
        void toggleTheme();
      }}
      aria-label={
        isDark
          ? labels.nav.themeToggleAriaToLight
          : labels.nav.themeToggleAriaToDark
      }
    >
      <span className="theme-btn__icon" aria-hidden="true">
        {isDark ? <IconSun size={16} /> : <IconMoon size={16} />}
      </span>
      <span>
        {compact
          ? isDark
            ? 'Light'
            : 'Dark'
          : isDark
            ? labels.nav.switchToLight
            : labels.nav.switchToDark}
      </span>
    </button>
  );
}

export interface OnboardingLayoutProps {
  children: React.ReactNode;
  wideOnDesktop?: boolean;
  headerAction?: React.ReactNode;
}

export function OnboardingLayout({
  children,
  wideOnDesktop = false,
  headerAction,
}: OnboardingLayoutProps): React.ReactElement {
  const { session } = useAuthSession();
  const networkState = useNetworkStatus();

  return (
    <div className="app-shell app-shell--onboarding">
      <a href="#main-content" className="skip-link">
        {labels.app.skipToMain}
      </a>

      <header className="app-header">
        <div
          className={
            wideOnDesktop
              ? 'app-header__inner app-header__inner--wide-onboarding'
              : 'app-header__inner'
          }
        >
          <div className="app-header__brand-group">
            <span className="brand-lockup">
              <BrandMark size={30} className="brand-lockup__mark" />
              <span className="brand-lockup__name">{labels.app.name}</span>
            </span>
            <NetworkStatus state={networkState} />
          </div>
          <div className="app-header__controls">
            {headerAction}
            <ThemeQuickSwitch />
          </div>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className={
          wideOnDesktop
            ? 'app-main app-main--onboarding app-main--wide-onboarding'
            : 'app-main app-main--onboarding'
        }
      >
        <div className="app-container">{children}</div>
      </main>

      <footer className="app-footer app-footer--onboarding">
        <div
          className={
            wideOnDesktop
              ? 'app-footer__inner app-footer__inner--wide-onboarding'
              : 'app-footer__inner'
          }
        >
          <p className="app-footer__meta">
            {session
              ? `${session.user.displayName} (${labels.app.roleUnassigned})`
              : labels.app.footerUnauthenticated}
          </p>
        </div>
      </footer>
    </div>
  );
}

export function AppLayout(): React.ReactElement {
  const { session, signOut } = useAuthSession();
  const networkState = useNetworkStatus();
  const {
    isSyncing,
    lastSyncAt,
    pendingChanges,
    hasFailedChanges,
    lastError,
    syncNow,
    retry,
  } = useSyncStatus();
  const navigate = useNavigate();
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState<boolean>(false);

  const isRep = session?.user.role === 'rep';
  const currentClass = session?.currentClass ?? null;
  const roleLabel = isRep ? labels.app.roleRep : labels.app.roleStudent;
  const displayName = session?.user.displayName ?? 'Student';

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent): void => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault();
        setIsQuickSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  const handleSignOut = async (): Promise<void> => {
    await signOut();
    navigate('/signin');
  };

  return (
    <div className="app-shell app-shell--with-sidenav">
      <a href="#main-content" className="skip-link">
        {labels.app.skipToMain}
      </a>

      {/* Desktop Left Sidebar (>= 1024px) */}
      <aside className="figma-sidenav" aria-label={labels.nav.ariaLabel}>
        <div className="figma-sidenav__header">
          <Link to="/" className="brand-lockup">
            <BrandMark size={34} className="brand-lockup__mark" />
            <span className="brand-lockup__text">
              <span className="brand-lockup__name">{labels.app.name}</span>
              <span className="brand-lockup__sub">STUDY INDEX</span>
            </span>
          </Link>

          <div className="figma-sidenav__meta-well">
            {currentClass ? (
              <span className="mono-code" style={{ fontSize: '12px', fontWeight: 700 }}>
                {currentClass.joinCode}
              </span>
            ) : (
              <span className="meta-text" style={{ fontSize: '12px' }}>No class</span>
            )}
            <NetworkStatus state={networkState} />
          </div>

          <button
            type="button"
            className="figma-sidenav__search-btn"
            onClick={() => setIsQuickSearchOpen(true)}
            aria-label="Open quick search (Ctrl+K)"
          >
            <span className="figma-sidenav__search-left">
              <IconSearch size={15} />
              <span>Quick search</span>
            </span>
            <kbd className="kbd-badge">Ctrl K</kbd>
          </button>
        </div>

        <nav className="figma-sidenav__nav">
          <p className="figma-sidenav__nav-label">WORKSPACE</p>
          <ul className="figma-sidenav__list">
            <li>
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  isActive
                    ? 'figma-sidenav__link figma-sidenav__link--active'
                    : 'figma-sidenav__link'
                }
              >
                <IconHome size={19} />
                <span>{labels.nav.home}</span>
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/courses"
                className={({ isActive }) =>
                  isActive
                    ? 'figma-sidenav__link figma-sidenav__link--active'
                    : 'figma-sidenav__link'
                }
              >
                <IconBook size={19} />
                <span>{labels.nav.courses}</span>
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/deadlines"
                className={({ isActive }) =>
                  isActive
                    ? 'figma-sidenav__link figma-sidenav__link--active'
                    : 'figma-sidenav__link'
                }
              >
                <IconCalendarCheck size={19} />
                <span>Deadlines</span>
              </NavLink>
            </li>
            {isRep ? (
              <li>
                <NavLink
                  to="/manage"
                  className={({ isActive }) =>
                    isActive
                      ? 'figma-sidenav__link figma-sidenav__link--active'
                      : 'figma-sidenav__link'
                  }
                >
                  <IconNote size={19} />
                  <span>{labels.nav.manage}</span>
                </NavLink>
              </li>
            ) : null}
            <li>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  isActive
                    ? 'figma-sidenav__link figma-sidenav__link--active'
                    : 'figma-sidenav__link'
                }
              >
                <IconSettings size={19} />
                <span>{labels.nav.settings}</span>
              </NavLink>
            </li>
          </ul>
        </nav>

        <div className="figma-sidenav__footer">
          <div className="figma-sidenav__profile">
            <span className="user-avatar" aria-hidden="true">
              {getInitials(displayName)}
            </span>
            <div className="figma-sidenav__user-info">
              <span className="figma-sidenav__user-name">{displayName}</span>
              <span className="figma-sidenav__user-role">{roleLabel}</span>
            </div>
          </div>
          <div className="figma-sidenav__actions">
            <ThemeQuickSwitch compact />
            <button
              type="button"
              className="btn btn-secondary figma-sidenav__logout-btn"
              onClick={() => void handleSignOut()}
              title="Sign out"
            >
              <IconLogout size={15} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Study Workspace Area */}
      <div className="app-workspace">
        {/* Mobile / Tablet Top Header */}
        <header className="app-header">
          <div className="app-header__inner">
            <div className="app-header__brand-group">
              <Link to="/" className="brand-lockup">
                <BrandMark size={28} className="brand-lockup__mark" />
                <span className="brand-lockup__name">{labels.app.name}</span>
              </Link>
              {currentClass ? (
                <span className="status-chip mono-code">
                  {currentClass.joinCode}
                </span>
              ) : null}
              <NetworkStatus state={networkState} />
            </div>

            <div className="app-header__controls">
              <button
                type="button"
                className="btn btn-secondary app-theme-btn"
                onClick={() => setIsQuickSearchOpen(true)}
                aria-label="Open quick search"
              >
                <IconSearch size={15} />
                <span>Search</span>
              </button>
              <ThemeQuickSwitch compact />
            </div>
          </div>
        </header>

        {/* Content Viewport */}
        <main id="main-content" tabIndex={-1} className="app-main">
          <div className="app-container">
            {networkState === 'offline' ? (
              <div className="offline-strip" role="status">
                <span className="offline-strip__lead">
                  <IconWifiOff size={16} />
                  <span>
                    Offline mode. Showing saved courses, materials, and notes from this device.
                  </span>
                </span>
              </div>
            ) : null}

            {pendingChanges > 0 || hasFailedChanges ? (
              <div className="sync-banner" role="status">
                <span>
                  {hasFailedChanges
                    ? lastError ?? 'Sync needs attention. Local edits remain safe.'
                    : `${pendingChanges} change${pendingChanges === 1 ? '' : 's'} waiting to sync.`}
                </span>
                <span>
                  Saved on this device.
                  {lastSyncAt ? ` Last updated: ${formatDateTime(lastSyncAt)}.` : ''}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-compact"
                  disabled={isSyncing || networkState === 'offline'}
                  onClick={() =>
                    void (hasFailedChanges ? retry() : syncNow())
                  }
                >
                  <IconRefresh size={14} className={isSyncing ? 'anim-spin' : undefined} />
                  <span>
                    {isSyncing
                      ? 'Syncing...'
                      : hasFailedChanges
                        ? 'Try again'
                        : 'Sync now'}
                  </span>
                </button>
              </div>
            ) : null}
            <Outlet />
          </div>
        </main>

        {/* Mobile Bottom Navigation (< 1024px) */}
        <nav className="figma-bottom-nav" aria-label={labels.nav.ariaLabel}>
          <ul className="figma-bottom-nav__list">
            <li className="figma-bottom-nav__item">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  isActive
                    ? 'figma-bottom-nav__link figma-bottom-nav__link--active'
                    : 'figma-bottom-nav__link'
                }
              >
                <IconHome size={20} />
                <span>{labels.nav.home}</span>
              </NavLink>
            </li>
            <li className="figma-bottom-nav__item">
              <NavLink
                to="/courses"
                className={({ isActive }) =>
                  isActive
                    ? 'figma-bottom-nav__link figma-bottom-nav__link--active'
                    : 'figma-bottom-nav__link'
                }
              >
                <IconBook size={20} />
                <span>{labels.nav.courses}</span>
              </NavLink>
            </li>
            <li className="figma-bottom-nav__item">
              <NavLink
                to="/deadlines"
                className={({ isActive }) =>
                  isActive
                    ? 'figma-bottom-nav__link figma-bottom-nav__link--active'
                    : 'figma-bottom-nav__link'
                }
              >
                <IconCalendarCheck size={20} />
                <span>Deadlines</span>
              </NavLink>
            </li>
            {isRep ? (
              <li className="figma-bottom-nav__item">
                <NavLink
                  to="/manage"
                  className={({ isActive }) =>
                    isActive
                      ? 'figma-bottom-nav__link figma-bottom-nav__link--active'
                      : 'figma-bottom-nav__link'
                  }
                >
                  <IconNote size={20} />
                  <span>{labels.nav.manage}</span>
                </NavLink>
              </li>
            ) : null}
            <li className="figma-bottom-nav__item">
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  isActive
                    ? 'figma-bottom-nav__link figma-bottom-nav__link--active'
                    : 'figma-bottom-nav__link'
                }
              >
                <IconSettings size={20} />
                <span>{labels.nav.settings}</span>
              </NavLink>
            </li>
          </ul>
        </nav>

        {/* Global Footer */}
        <footer className="app-footer">
          <div className="app-footer__inner">
            <p className="app-footer__meta">
              {currentClass
                ? `${labels.app.footerClassMemberPrefix} ${currentClass.name} (${currentClass.joinCode})`
                : labels.app.footerUnauthenticated}
            </p>
            {session ? <span className="status-chip">{roleLabel}</span> : null}
          </div>
        </footer>
      </div>

      <QuickSearchModal
        isOpen={isQuickSearchOpen}
        onClose={() => setIsQuickSearchOpen(false)}
        classId={session?.user.classId ?? null}
        userId={session?.user.id ?? null}
        isRep={Boolean(isRep)}
      />
    </div>
  );
}
