import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AppLayout, OnboardingLayout } from '../presentation/components/AppLayout';
import { LoadingState } from '../presentation/components/StateViews';
import {
  AuthSessionProvider,
  useAuthSession,
} from '../presentation/hooks/useAuthSession';
import { ThemeProvider } from '../presentation/hooks/useTheme';
import { labels } from '../presentation/i18n/labels';

const SignInPage = lazy(() => import('../presentation/pages/SignInPage'));
const JoinClassPage = lazy(() => import('../presentation/pages/JoinClassPage'));
const HomePage = lazy(() => import('../presentation/pages/HomePage'));
const CoursesPage = lazy(() => import('../presentation/pages/CoursesPage'));
const CourseDetailPage = lazy(
  () => import('../presentation/pages/CourseDetailPage'),
);
const MaterialDetailPage = lazy(
  () => import('../presentation/pages/MaterialDetailPage'),
);
const RepFormPage = lazy(() => import('../presentation/pages/RepFormPage'));
const SettingsPage = lazy(() => import('../presentation/pages/SettingsPage'));

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

function SignInRouteGuard(): React.ReactElement {
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
  return (
    <Suspense
      fallback={
        <OnboardingLayout>
          <div className="page-stack">
            <h1>{labels.auth.signInHeading}</h1>
            <LoadingState message={labels.common.loadingPage} />
          </div>
        </OnboardingLayout>
      }
    >
      <SignInPage />
    </Suspense>
  );
}

function JoinClassRouteGuard(): React.ReactElement {
  const { session, isLoading } = useAuthSession();
  if (isLoading) {
    return <WorkspaceBootScreen />;
  }
  if (!session) {
    return <Navigate to="/signin" replace />;
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
    return <Navigate to="/signin" replace />;
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
  return (
    <Suspense fallback={<LoadingState message={labels.common.loadingPage} />}>
      {children}
    </Suspense>
  );
}

export function AppRoutes(): React.ReactElement {
  return (
    <Routes>
      <Route path="/signin" element={<SignInRouteGuard />} />
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

export function AppRouter(): React.ReactElement {
  return (
    <ThemeProvider>
      <AuthSessionProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthSessionProvider>
    </ThemeProvider>
  );
}
