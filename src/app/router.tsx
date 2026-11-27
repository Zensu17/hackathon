import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { Toaster } from 'sonner';
import { AppLayout, OnboardingLayout } from '../presentation/components/AppLayout';
import { AppErrorBoundary } from '../presentation/components/ErrorBoundary';
import { LoadingState } from '../presentation/components/StateViews';
import {
  AuthSessionProvider,
  useAuthSession,
} from '../presentation/hooks/useAuthSession';
import { ThemeProvider, useTheme } from '../presentation/hooks/useTheme';
import { labels } from '../presentation/i18n/labels';
import {
  loadAdminUsersPage,
  loadCourseDetailPage,
  loadCoursesPage,
  loadDeadlinesPage,
  loadHomePage,
  loadJoinClassPage,
  loadLoginPage,
  loadMaterialDetailPage,
  loadProfilePage,
  loadRegisterPage,
  loadRepFormPage,
  loadSettingsPage,
} from '../presentation/utils/routePrefetch';

const LoginPage = lazy(loadLoginPage);
const RegisterPage = lazy(loadRegisterPage);
const JoinClassPage = lazy(loadJoinClassPage);
const HomePage = lazy(loadHomePage);
const CoursesPage = lazy(loadCoursesPage);
const DeadlinesPage = lazy(loadDeadlinesPage);
const CourseDetailPage = lazy(loadCourseDetailPage);
const MaterialDetailPage = lazy(loadMaterialDetailPage);
const RepFormPage = lazy(loadRepFormPage);
const AdminUsersPage = lazy(loadAdminUsersPage);
const ProfilePage = lazy(loadProfilePage);
const SettingsPage = lazy(loadSettingsPage);

function RouteScrollReset(): null {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, [location.pathname, location.hash]);

  return null;
}

function WorkspaceBootScreen(): React.ReactElement {
  return (
    <OnboardingLayout>
      <div className="page-stack">
        <h1>{labels.app.name}</h1>
        <LoadingState message={labels.common.loadingWorkspace} />
      </div>
    </OnboardingLayout>
  );
}

function GuestRouteGuard({
  screen,
}: {
  screen: 'login' | 'register';
}): React.ReactElement {
  const { session, isLoading } = useAuthSession();
  if (isLoading) {
    return <WorkspaceBootScreen />;
  }
  if (session) {
    if (session.user.classId && session.currentClass) {
      return <Navigate to="/" replace />;
    }
    return <Navigate to="/join-class" replace />;
  }
  const heading =
    screen === 'login' ? labels.auth.signInHeading : labels.auth.signUpHeading;

  return (
    <Suspense
      fallback={
        <OnboardingLayout>
          <div className="page-stack">
            <h1>{heading}</h1>
            <LoadingState message={labels.common.loadingPage} />
          </div>
        </OnboardingLayout>
      }
    >
      {screen === 'login' ? <LoginPage /> : <RegisterPage />}
    </Suspense>
  );
}

function JoinClassRouteGuard(): React.ReactElement {
  const { session, isLoading } = useAuthSession();
  if (isLoading) {
    return <WorkspaceBootScreen />;
  }
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (session.user.classId && session.currentClass) {
    return <Navigate to="/" replace />;
  }
  return (
    <Suspense
      fallback={
        <OnboardingLayout wideOnDesktop>
          <div className="page-stack">
            <h1>{labels.joinClass.heading}</h1>
            <LoadingState message={labels.common.loadingPage} />
          </div>
        </OnboardingLayout>
      }
    >
      <JoinClassPage />
    </Suspense>
  );
}

function ProtectedShellGuard(): React.ReactElement {
  const { session, isLoading } = useAuthSession();
  if (isLoading) {
    return <WorkspaceBootScreen />;
  }
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (!session.user.classId || !session.currentClass) {
    return <Navigate to="/join-class" replace />;
  }
  return <AppLayout />;
}

function LazyScreen({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const location = useLocation();
  return (
    <AppErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<LoadingState message={labels.common.loadingPage} />}>
        {children}
      </Suspense>
    </AppErrorBoundary>
  );
}

export function AppRoutes(): React.ReactElement {
  return (
    <Routes>
      <Route path="/login" element={<GuestRouteGuard screen="login" />} />
      <Route path="/register" element={<GuestRouteGuard screen="register" />} />
      <Route path="/signin" element={<Navigate to="/login" replace />} />
      <Route path="/signup" element={<Navigate to="/register" replace />} />
      <Route path="/join-class" element={<JoinClassRouteGuard />} />
      <Route element={<ProtectedShellGuard />}>
        <Route
          path="/"
          element={
            <LazyScreen>
              <HomePage />
            </LazyScreen>
          }
        />
        <Route
          path="/deadlines"
          element={
            <LazyScreen>
              <DeadlinesPage />
            </LazyScreen>
          }
        />
        <Route
          path="/courses"
          element={
            <LazyScreen>
              <CoursesPage />
            </LazyScreen>
          }
        />
        <Route
          path="/courses/:courseId"
          element={
            <LazyScreen>
              <CourseDetailPage />
            </LazyScreen>
          }
        />
        <Route
          path="/materials/:materialId"
          element={
            <LazyScreen>
              <MaterialDetailPage />
            </LazyScreen>
          }
        />
        <Route
          path="/manage"
          element={
            <LazyScreen>
              <RepFormPage />
            </LazyScreen>
          }
        />
        <Route
          path="/admin/users"
          element={
            <LazyScreen>
              <AdminUsersPage />
            </LazyScreen>
          }
        />
        <Route
          path="/profile"
          element={
            <LazyScreen>
              <ProfilePage />
            </LazyScreen>
          }
        />
        <Route
          path="/settings"
          element={
            <LazyScreen>
              <SettingsPage />
            </LazyScreen>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AppToaster(): React.ReactElement {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      richColors
      closeButton
      offset={20}
      mobileOffset={{ bottom: 80, left: 16, right: 16 }}
      toastOptions={{
        style: {
          fontFamily: 'var(--font-sans)',
          borderRadius: '12px',
        },
      }}
    />
  );
}

export function AppRouter(): React.ReactElement {
  return (
    <ThemeProvider>
      <AppErrorBoundary>
        <AuthSessionProvider>
          <BrowserRouter>
            <RouteScrollReset />
            <AppRoutes />
          </BrowserRouter>
          <AppToaster />
        </AuthSessionProvider>
      </AppErrorBoundary>
    </ThemeProvider>
  );
}
