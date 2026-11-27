// Shared lazy route loaders for React Router and hover/focus prefetching.
export const loadLoginPage = () => import('../pages/LoginPage');
export const loadRegisterPage = () => import('../pages/RegisterPage');
export const loadJoinClassPage = () => import('../pages/JoinClassPage');
export const loadHomePage = () => import('../pages/HomePage');
export const loadCoursesPage = () => import('../pages/CoursesPage');
export const loadDeadlinesPage = () => import('../pages/DeadlinesPage');
export const loadCourseDetailPage = () => import('../pages/CourseDetailPage');
export const loadMaterialDetailPage = () => import('../pages/MaterialDetailPage');
export const loadRepFormPage = () => import('../pages/RepFormPage');
export const loadAdminUsersPage = () => import('../pages/AdminUsersPage');
export const loadProfilePage = () => import('../pages/ProfilePage');
export const loadSettingsPage = () => import('../pages/SettingsPage');

const prefetchedRoutes = new Set<string>();

function normalizeRouteKey(rawPath: string): string {
  const pathOnly = rawPath.split('?')[0]?.split('#')[0] ?? '/';
  if (pathOnly === '/signin') return '/login';
  if (pathOnly === '/signup') return '/register';
  return pathOnly || '/';
}

/**
 * Warm up lazy route chunks on pointer hover or keyboard focus so menu
 * transitions stay immediate without loading unused bundles upfront.
 */
export function prefetchRoute(rawPath: string): void {
  const key = normalizeRouteKey(rawPath);
  if (prefetchedRoutes.has(key)) {
    return;
  }

  let loader: (() => Promise<unknown>) | null = null;
  if (key === '/') {
    loader = loadHomePage;
  } else if (key === '/courses') {
    loader = loadCoursesPage;
  } else if (key === '/deadlines') {
    loader = loadDeadlinesPage;
  } else if (key === '/manage') {
    loader = loadRepFormPage;
  } else if (key === '/admin/users') {
    loader = loadAdminUsersPage;
  } else if (key === '/profile') {
    loader = loadProfilePage;
  } else if (key === '/settings') {
    loader = loadSettingsPage;
  } else if (key === '/login') {
    loader = loadLoginPage;
  } else if (key === '/register') {
    loader = loadRegisterPage;
  } else if (key === '/join-class') {
    loader = loadJoinClassPage;
  } else if (key.startsWith('/courses/')) {
    loader = loadCourseDetailPage;
  } else if (key.startsWith('/materials/')) {
    loader = loadMaterialDetailPage;
  }

  if (!loader) {
    return;
  }

  prefetchedRoutes.add(key);
  void loader().catch(() => {
    // Allow retry if offline or network failed momentarily.
    prefetchedRoutes.delete(key);
  });
}

