import React from 'react';
import { AppError } from '../application/errors/AppError';
import {
  CreateAnnouncement,
  CreateClass,
  CreateCourse,
  CreateDeadline,
  CreateMaterial,
  CreateWeek,
  FollowCourse,
  GetCourseWeeks,
  GetCurrentUser,
  GetMaterial,
  GetUpcomingDeadlines,
  JoinClass,
  ListAnnouncements,
  ListCourses,
  SignIn,
  SignOut,
  SignUp,
  UnfollowCourse,
  UpdateAnnouncement,
  UpdateCourse,
  UpdateDeadline,
  UpdateMaterial,
  UpdateWeek,
} from '../application/usecases';
import { LiteLearnDb } from '../data/local/LiteLearnDb';
import { seedSampleClassData } from '../data/local/seed';
import { SupabaseRemoteDataSource } from '../data/remote/SupabaseRemoteDataSource';
import { createSupabaseClientFromEnv } from '../data/remote/supabaseClient';
import { DexieNoteRepository } from '../data/repositories/DexieNoteRepository';
import { DexieSyncQueueRepository } from '../data/repositories/DexieSyncQueueRepository';
import { HybridAnnouncementRepository } from '../data/repositories/HybridAnnouncementRepository';
import { HybridAuthRepository } from '../data/repositories/HybridAuthRepository';
import { HybridClassRepository } from '../data/repositories/HybridClassRepository';
import { HybridCourseRepository } from '../data/repositories/HybridCourseRepository';
import { HybridDeadlineRepository } from '../data/repositories/HybridDeadlineRepository';
import { HybridMaterialRepository } from '../data/repositories/HybridMaterialRepository';
import { HybridWeekRepository } from '../data/repositories/HybridWeekRepository';
import { parseAllowedEmailDomains } from '../domain/rules';

const THEME_META_KEY = 'theme_preference';

export type ThemePreference = 'light' | 'dark';

export interface AppUseCases {
  readonly signUp: SignUp;
  readonly signIn: SignIn;
  readonly signOut: SignOut;
  readonly getCurrentUser: GetCurrentUser;
  readonly joinClass: JoinClass;
  readonly createClass: CreateClass;
  readonly listCourses: ListCourses;
  readonly followCourse: FollowCourse;
  readonly unfollowCourse: UnfollowCourse;
  readonly getCourseWeeks: GetCourseWeeks;
  readonly getMaterial: GetMaterial;
  readonly getUpcomingDeadlines: GetUpcomingDeadlines;
  readonly listAnnouncements: ListAnnouncements;
  readonly createCourse: CreateCourse;
  readonly updateCourse: UpdateCourse;
  readonly createWeek: CreateWeek;
  readonly updateWeek: UpdateWeek;
  readonly createMaterial: CreateMaterial;
  readonly updateMaterial: UpdateMaterial;
  readonly createDeadline: CreateDeadline;
  readonly updateDeadline: UpdateDeadline;
  readonly createAnnouncement: CreateAnnouncement;
  readonly updateAnnouncement: UpdateAnnouncement;
}

export interface AppContainer {
  readonly usecases: AppUseCases;
  readonly isLocalFallbackMode: boolean;
  getThemePreference(): Promise<ThemePreference | null>;
  setThemePreference(theme: ThemePreference): Promise<void>;
  loadSampleSeedData(
    userId: string,
  ): Promise<{ classId: string; joinCode: string }>;
}

export interface CreateAppContainerOptions {
  databaseName?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  allowedEmailDomainsRaw?: string;
}

function applyDocumentTheme(theme: ThemePreference): void {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.dataset.theme = theme;
  }
}

export function createAppContainer(
  options: CreateAppContainerOptions = {},
): AppContainer {
  const db = new LiteLearnDb(options.databaseName ?? 'litelearn_db');
  const supabaseClient = createSupabaseClientFromEnv(
    options.supabaseUrl,
    options.supabaseAnonKey,
  );
  const remote = supabaseClient
    ? new SupabaseRemoteDataSource(supabaseClient)
    : null;
  const isLocalFallbackMode = remote === null;

  const allowedDomains = parseAllowedEmailDomains(
    options.allowedEmailDomainsRaw ?? import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS,
  );

  const authRepository = new HybridAuthRepository(db, remote);
  const classRepository = new HybridClassRepository(db, remote);
  const courseRepository = new HybridCourseRepository(db, remote);
  const weekRepository = new HybridWeekRepository(db, remote);
  const materialRepository = new HybridMaterialRepository(db, remote);
  const deadlineRepository = new HybridDeadlineRepository(db, remote);
  const announcementRepository = new HybridAnnouncementRepository(db, remote);
  // Instantiate Phase 2 note and syncQueue repositories inside the composition root so schema stores stay wired.
  void new DexieNoteRepository(db);
  void new DexieSyncQueueRepository(db);

  const usecases: AppUseCases = {
    signUp: new SignUp(authRepository, allowedDomains),
    signIn: new SignIn(authRepository),
    signOut: new SignOut(authRepository),
    getCurrentUser: new GetCurrentUser(authRepository, classRepository),
    joinClass: new JoinClass(classRepository),
    createClass: new CreateClass(classRepository),
    listCourses: new ListCourses(courseRepository),
    followCourse: new FollowCourse(courseRepository),
    unfollowCourse: new UnfollowCourse(courseRepository),
    getCourseWeeks: new GetCourseWeeks(
      courseRepository,
      weekRepository,
      materialRepository,
      deadlineRepository,
    ),
    getMaterial: new GetMaterial(
      materialRepository,
      courseRepository,
      weekRepository,
    ),
    getUpcomingDeadlines: new GetUpcomingDeadlines(
      courseRepository,
      deadlineRepository,
    ),
    listAnnouncements: new ListAnnouncements(announcementRepository),
    createCourse: new CreateCourse(courseRepository),
    updateCourse: new UpdateCourse(courseRepository),
    createWeek: new CreateWeek(courseRepository, weekRepository),
    updateWeek: new UpdateWeek(courseRepository, weekRepository),
    createMaterial: new CreateMaterial(
      courseRepository,
      weekRepository,
      materialRepository,
    ),
    updateMaterial: new UpdateMaterial(
      courseRepository,
      weekRepository,
      materialRepository,
    ),
    createDeadline: new CreateDeadline(
      courseRepository,
      weekRepository,
      deadlineRepository,
    ),
    updateDeadline: new UpdateDeadline(
      courseRepository,
      weekRepository,
      deadlineRepository,
    ),
    createAnnouncement: new CreateAnnouncement(
      courseRepository,
      announcementRepository,
    ),
    updateAnnouncement: new UpdateAnnouncement(
      courseRepository,
      announcementRepository,
    ),
  };

  return {
    usecases,
    isLocalFallbackMode,
    async getThemePreference(): Promise<ThemePreference | null> {
      const row = await db.meta.get(THEME_META_KEY);
      if (row?.value === 'light' || row?.value === 'dark') {
        applyDocumentTheme(row.value);
        return row.value;
      }
      return null;
    },
    async setThemePreference(theme: ThemePreference): Promise<void> {
      await db.meta.put({ key: THEME_META_KEY, value: theme });
      applyDocumentTheme(theme);
    },
    async loadSampleSeedData(
      userId: string,
    ): Promise<{ classId: string; joinCode: string }> {
      if (!isLocalFallbackMode) {
        throw new AppError(
          'FORBIDDEN_ROLE',
          'Sample seed data is only available in local fallback mode.',
        );
      }
      const trimmedUserId = userId.trim();
      if (trimmedUserId.length === 0) {
        throw new AppError('VALIDATION_ERROR', 'User ID is required.');
      }
      return seedSampleClassData(db, trimmedUserId);
    },
  };
}

const AppContainerContext = React.createContext<AppContainer | null>(null);

let defaultContainerInstance: AppContainer | null = null;

function getDefaultContainer(): AppContainer {
  if (!defaultContainerInstance) {
    defaultContainerInstance = createAppContainer();
  }
  return defaultContainerInstance;
}

export interface AppContainerProviderProps {
  container?: AppContainer;
  children?: React.ReactNode;
}

export function AppContainerProvider({
  container,
  children,
}: AppContainerProviderProps): React.ReactElement {
  const resolved = React.useMemo(
    () => container ?? getDefaultContainer(),
    [container],
  );
  return React.createElement(
    AppContainerContext.Provider,
    { value: resolved },
    children,
  );
}

export function useAppContainer(): AppContainer {
  const container = React.useContext(AppContainerContext);
  if (!container) {
    throw new Error(
      'useAppContainer must be called inside AppContainerProvider.',
    );
  }
  return container;
}
