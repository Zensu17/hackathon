import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { canManageClassContent, isAdminRole } from '../../domain/rules';
import { useAuthSession } from '../hooks/useAuthSession';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useSlidingIndicator } from '../hooks/useSlidingIndicator';
import { useTheme } from '../hooks/useTheme';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { labels } from '../i18n/labels';
import {
  BrandMark,
  IconArrowUp,
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
  IconUsers,
  IconWifiOff,
} from './Icons';
import { NetworkStatus } from './FigmaComponents';
import { QuickSearchModal } from './QuickSearchModal';
import { UserAvatar } from './UserAvatar';
import { formatDateTime, getRoleLabel } from '../utils/formatters';
import { prefetchRoute } from '../utils/routePrefetch';
import './AppLayout.css';

interface NavEntry {
  to: string;
  end?: boolean;
  label: string;
  icon: React.ReactNode;
  mobileIcon: React.ReactNode;
  showInBottomNav: boolean;
}

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
      <span
        key={theme}
        className="theme-btn__icon theme-btn__icon--animate"
        aria-hidden="true"
      >
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
  const location = useLocation();
  const sideNavHostRef = useRef<HTMLDivElement | null>(null);
  const bottomNavHostRef = useRef<HTMLDivElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState<boolean>(false);
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);

  const isManager = canManageClassContent(session?.user.role);
  const isAdmin = isAdminRole(session?.user.role);
  const currentClass = session?.currentClass ?? null;
  const roleLabel = getRoleLabel(session?.user.role);
  const displayName = session?.user.displayName ?? 'Member';

  const { indicatorStyle: sideIndicatorStyle } = useSlidingIndicator(
    sideNavHostRef,
    '.figma-sidenav__link--active',
    [location.pathname, isManager, isAdmin],
  );
  const { indicatorStyle: bottomIndicatorStyle } = useSlidingIndicator(
    bottomNavHostRef,
    '.figma-bottom-nav__link--active',
    [location.pathname, isManager],
  );

  useEffect(() => {
    let rafId = 0;

    const updateScrollMetrics = (): void => {
      rafId = 0;
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      const maxScroll = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const ratio = maxScroll > 0 ? Math.min(1, Math.max(0, scrollTop / maxScroll)) : 0;

      if (progressBarRef.current) {
        progressBarRef.current.style.transform = `scaleX(${ratio})`;
        progressBarRef.current.style.opacity = maxScroll > 160 ? '1' : '0';
      }
      setShowScrollTop(scrollTop > 420);
    };

    const onScrollOrResize = (): void => {
      if (rafId === 0) {
        rafId = window.requestAnimationFrame(updateScrollMetrics);
      }
    };

    updateScrollMetrics();
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });
    return () => {
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [location.pathname]);

  const navItems: NavEntry[] = [
    {
      to: '/',
      end: true,
      label: labels.nav.home,
      icon: <IconHome size={19} />,
      mobileIcon: <IconHome size={20} />,
      showInBottomNav: true,
    },
    {
      to: '/courses',
      label: labels.nav.courses,
      icon: <IconBook size={19} />,
      mobileIcon: <IconBook size={20} />,
      showInBottomNav: true,
    },
    {
      to: '/deadlines',
      label: 'Deadlines',
      icon: <IconCalendarCheck size={19} />,
      mobileIcon: <IconCalendarCheck size={20} />,
      showInBottomNav: true,
    },
    ...(isManager
      ? [
          {
            to: '/manage',
            label: labels.nav.manage,
            icon: <IconNote size={19} />,
            mobileIcon: <IconNote size={20} />,
            showInBottomNav: true,
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            to: '/admin/users',
            label: labels.nav.adminUsers,
            icon: <IconUsers size={19} />,
            mobileIcon: <IconUsers size={20} />,
            showInBottomNav: false,
          },
        ]
      : []),
    {
      to: '/settings',
      label: labels.nav.settings,
      icon: <IconSettings size={19} />,
      mobileIcon: <IconSettings size={20} />,
      showInBottomNav: true,
    },
  ];

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
    navigate('/login');
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
          <div ref={sideNavHostRef} className="figma-nav-indicator-host">
            <span
              className="figma-sidenav__indicator"
              style={sideIndicatorStyle}
              aria-hidden="true"
            />
            <ul className="figma-sidenav__list">
              {navItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onPointerEnter={() => prefetchRoute(item.to)}
                    onFocus={() => prefetchRoute(item.to)}
                    className={({ isActive }) =>
                      isActive
                        ? 'figma-sidenav__link figma-sidenav__link--active'
                        : 'figma-sidenav__link'
                    }
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="figma-sidenav__footer">
          <Link
            to="/profile"
            className="figma-sidenav__profile"
            aria-label="Customize profile"
            title="Open profile customization"
            onPointerEnter={() => prefetchRoute('/profile')}
            onFocus={() => prefetchRoute('/profile')}
          >
            <UserAvatar
              displayName={displayName}
              avatarColor={session?.user.avatarColor}
              avatarDataUrl={session?.user.avatarDataUrl}
              size="md"
            />
            <div className="figma-sidenav__user-info">
              <span className="figma-sidenav__user-name">{displayName}</span>
              <span className="figma-sidenav__user-role">{roleLabel}</span>
            </div>
          </Link>
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
        <div
          ref={progressBarRef}
          className="scroll-progress-bar"
          aria-hidden="true"
        />

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
              <Link
                to="/profile"
                className="mobile-profile-btn"
                aria-label="Customize profile"
                title="Customize profile"
                onPointerEnter={() => prefetchRoute('/profile')}
                onFocus={() => prefetchRoute('/profile')}
              >
                <UserAvatar
                  displayName={displayName}
                  avatarColor={session?.user.avatarColor}
                  avatarDataUrl={session?.user.avatarDataUrl}
                  size="sm"
                />
              </Link>
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
            <div key={location.pathname} className="route-stage">
              <Outlet />
            </div>
          </div>
        </main>

        {/* Mobile Bottom Navigation (< 1024px) */}
        <nav className="figma-bottom-nav" aria-label={labels.nav.ariaLabel}>
          <div ref={bottomNavHostRef} className="figma-bottom-nav__host">
            <span
              className="figma-bottom-nav__indicator"
              style={bottomIndicatorStyle}
              aria-hidden="true"
            />
            <ul className="figma-bottom-nav__list">
              {navItems
                .filter((item) => item.showInBottomNav)
                .map((item) => (
                  <li key={item.to} className="figma-bottom-nav__item">
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onPointerEnter={() => prefetchRoute(item.to)}
                      onFocus={() => prefetchRoute(item.to)}
                      className={({ isActive }) =>
                        isActive
                          ? 'figma-bottom-nav__link figma-bottom-nav__link--active'
                          : 'figma-bottom-nav__link'
                      }
                    >
                      {item.mobileIcon}
                      <span>{item.label}</span>
                    </NavLink>
                  </li>
                ))}
            </ul>
          </div>
        </nav>

        <button
          type="button"
          className={
            showScrollTop
              ? 'scroll-top-fab scroll-top-fab--visible'
              : 'scroll-top-fab'
          }
          aria-label="Scroll back to top"
          aria-hidden={!showScrollTop}
          tabIndex={showScrollTop ? 0 : -1}
          onClick={() => {
            const reduce =
              typeof window !== 'undefined' &&
              window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            window.scrollTo({
              top: 0,
              behavior: reduce ? 'auto' : 'smooth',
            });
          }}
        >
          <IconArrowUp size={16} />
          <span>Top</span>
        </button>

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
        isRep={Boolean(isManager)}
        isAdmin={Boolean(isAdmin)}
      />
    </div>
  );
}
