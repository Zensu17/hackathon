import React from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { useAuthSession } from '../hooks/useAuthSession';
import { useTheme } from '../hooks/useTheme';
import { labels } from '../i18n/labels';
import './AppLayout.css';

// Design Read: Offline study index for dormitory students on mobile phones, in a crisp academic index-card style, dial ENERGY 1 / RHYTHM 1 / MOTION 1.

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
      {isDark ? labels.nav.switchToLight : labels.nav.switchToDark}
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

  return (
    <div className="app-shell">
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
        {children}
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
  const { session } = useAuthSession();
  const isRep = session?.user.role === 'rep';
  const currentClass = session?.currentClass ?? null;
  const roleLabel = isRep ? labels.app.roleRep : labels.app.roleStudent;

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        {labels.app.skipToMain}
      </a>

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
          </div>

          <nav className="app-nav" aria-label={labels.nav.ariaLabel}>
            <ul className="app-nav__list">
              <li className="app-nav__item">
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    isActive
                      ? 'app-nav__link app-nav__link--active'
                      : 'app-nav__link'
                  }
                >
                  {labels.nav.home}
                </NavLink>
              </li>
              <li className="app-nav__item">
                <NavLink
                  to="/courses"
                  className={({ isActive }) =>
                    isActive
                      ? 'app-nav__link app-nav__link--active'
                      : 'app-nav__link'
                  }
                >
                  {labels.nav.courses}
                </NavLink>
              </li>
              {isRep ? (
                <li className="app-nav__item">
                  <NavLink
                    to="/manage"
                    className={({ isActive }) =>
                      isActive
                        ? 'app-nav__link app-nav__link--active'
                        : 'app-nav__link'
                    }
                  >
                    {labels.nav.manage}
                  </NavLink>
                </li>
              ) : null}
              <li className="app-nav__item">
                <NavLink
                  to="/settings"
                  className={({ isActive }) =>
                    isActive
                      ? 'app-nav__link app-nav__link--active'
                      : 'app-nav__link'
                  }
                >
                  {labels.nav.settings}
                </NavLink>
              </li>
            </ul>
          </nav>

          <div className="app-header__controls">
            <ThemeQuickSwitch />
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="app-main">
        <Outlet />
      </main>

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
  );
}
