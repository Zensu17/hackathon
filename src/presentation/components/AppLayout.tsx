import React from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useAuthSession } from '../hooks/useAuthSession';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useTheme } from '../hooks/useTheme';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { labels } from '../i18n/labels';
import {
  IconBook,
  IconCalendarCheck,
  IconHome,
  IconLogout,
  IconMoon,
  IconNote,
  IconSettings,
  IconSun,
} from './Icons';
import { NetworkStatus } from './FigmaComponents';
import './AppLayout.css';

function ThemeQuickSwitch(): React.ReactElement {
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
      <span>{isDark ? labels.nav.switchToLight : labels.nav.switchToDark}</span>
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
            <span className="app-brand">{labels.app.name}</span>
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
  const { pendingChanges, hasFailedChanges, retry } = useSyncStatus();
  const navigate = useNavigate();

  const isRep = session?.user.role === 'rep';
  const currentClass = session?.currentClass ?? null;
  const roleLabel = isRep ? labels.app.roleRep : labels.app.roleStudent;

  const handleSignOut = async (): Promise<void> => {
    await signOut();
    navigate('/signin');
  };

  return (
    <div className="app-shell app-shell--with-sidenav">
      <a href="#main-content" className="skip-link">
        {labels.app.skipToMain}
      </a>

      {/* Figma Native SideNav for Laptop (1024+ px) */}
      <aside className="figma-sidenav" aria-label={labels.nav.ariaLabel}>
        <div className="figma-sidenav__header">
          <Link to="/" className="figma-sidenav__brand">
            {labels.app.name}
          </Link>
          {currentClass ? (
            <span className="status-chip mono-code">
              {currentClass.joinCode}
            </span>
          ) : null}
          <div style={{ marginTop: 'var(--space-2)' }}>
            <NetworkStatus state={networkState} />
          </div>
        </div>

        <nav className="figma-sidenav__nav">
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
                <IconHome size={20} />
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
                <IconBook size={20} />
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
                <IconCalendarCheck size={20} />
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
                  <IconNote size={20} />
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
                <IconSettings size={20} />
                <span>{labels.nav.settings}</span>
              </NavLink>
            </li>
          </ul>
        </nav>

        <div className="figma-sidenav__footer">
          <div className="figma-sidenav__user">
            <span className="figma-sidenav__user-name">
              {session?.user.displayName ?? 'Student'}
            </span>
            <span className="status-chip">{roleLabel}</span>
          </div>
          <div className="figma-sidenav__actions">
            <ThemeQuickSwitch />
            <button
              type="button"
              className="btn btn-secondary figma-sidenav__logout-btn"
              onClick={() => void handleSignOut()}
              title="Sign out"
            >
              <IconLogout size={16} />
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
              <Link to="/" className="app-brand">
                {labels.app.name}
              </Link>
              {currentClass ? (
                <span className="status-chip mono-code">
                  {currentClass.joinCode}
                </span>
              ) : null}
              <NetworkStatus state={networkState} />
            </div>

            <div className="app-header__controls">
              <ThemeQuickSwitch />
            </div>
          </div>
        </header>

        {/* Content Viewport */}
        <main id="main-content" tabIndex={-1} className="app-main">
          <div className="app-container">
            {pendingChanges > 0 ? (
              <div className="sync-banner" role="status">
                <span>
                  {hasFailedChanges
                    ? 'Sync needs attention.'
                    : `${pendingChanges} change${pendingChanges === 1 ? '' : 's'} waiting to sync.`}
                </span>
                <span>
                  Saved on this device. Changes will retry when connection returns.
                </span>
                {hasFailedChanges ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-compact"
                    onClick={() => void retry()}
                  >
                    Allow retry
                  </button>
                ) : null}
              </div>
            ) : null}
            <Outlet />
          </div>
        </main>

        {/* Mobile Bottom Navigation (360-767 px, up to 1023px) */}
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

        {/* Global Footer on Mobile/Tablet */}
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
    </div>
  );
}
