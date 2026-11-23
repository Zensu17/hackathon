import React from 'react';
import { AppError } from '../application/errors/AppError';
import {
  CreateAnnouncement,
  CreateClass,
  CreateCourse,
  CreateDeadline,
  CreateMaterial,
  CreateWeek,
  DownloadMaterialFile,
  FollowCourse,
  GetCourseWeeks,
  GetCurrentUser,
  GetMaterial,
  GetMaterialNote,
  GetOfflineMaterialFile,
  GetOfflineStudyOverview,
  GetUpcomingDeadlines,
  JoinClass,
  ListAnnouncements,
  ListCourses,
  ListRecentAnnouncements,
  RemoveOfflineMaterialFile,
  RunSync,
  SaveMaterialNote,
  SearchWorkspace,
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
import type { OfflineStorageStats } from '../domain/repositories';
import type {
  NetworkStatusService,
  SyncStateSummary,
} from '../domain/services';
import { LiteLearnDb } from '../data/local/LiteLearnDb';
import {
  seedInitialLocalDemo,
  seedSampleClassData,
} from '../data/local/seed';
import { SupabaseRemoteDataSource } from '../data/remote/SupabaseRemoteDataSource';
import {
  createLazySupabaseClientLoader,
  resolveSupabaseConfigFromEnv,
} from '../data/remote/supabaseClient';
import { DexieNoteRepository } from '../data/repositories/DexieNoteRepository';
import { DexieSyncQueueRepository } from '../data/repositories/DexieSyncQueueRepository';
import { HybridAnnouncementRepository } from '../data/repositories/HybridAnnouncementRepository';
import { HybridAuthRepository } from '../data/repositories/HybridAuthRepository';
import { HybridClassRepository } from '../data/repositories/HybridClassRepository';
import { HybridCourseRepository } from '../data/repositories/HybridCourseRepository';
import { HybridDeadlineRepository } from '../data/repositories/HybridDeadlineRepository';
import { HybridMaterialRepository } from '../data/repositories/HybridMaterialRepository';
import { HybridWeekRepository } from '../data/repositories/HybridWeekRepository';
import { BrowserNetworkStatusService } from '../data/services/BrowserNetworkStatusService';
import { LiteLearnSyncService } from '../data/services/LiteLearnSyncService';

const THEME_META_KEY = 'theme_preference';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

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
  readonly downloadMaterialFile: DownloadMaterialFile;
  readonly getOfflineMaterialFile: GetOfflineMaterialFile;
  readonly removeOfflineMaterialFile: RemoveOfflineMaterialFile;
  readonly getOfflineStudyOverview: GetOfflineStudyOverview;
  readonly getMaterialNote: GetMaterialNote;
  readonly saveMaterialNote: SaveMaterialNote;
  readonly getUpcomingDeadlines: GetUpcomingDeadlines;
  readonly listAnnouncements: ListAnnouncements;
  readonly listRecentAnnouncements: ListRecentAnnouncements;
  readonly searchWorkspace: SearchWorkspace;
  readonly runSync: RunSync;
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
  readonly networkStatus: NetworkStatusService;
  readonly isLocalFallbackMode: boolean;
  getThemePreference(): Promise<ThemePreference | null>;
  setThemePreference(theme: ThemePreference): Promise<void>;
  getDataSaverEnabled(): Promise<boolean>;
  setDataSaverEnabled(enabled: boolean): Promise<void>;
  getOfflineStorageStats(): Promise<OfflineStorageStats>;
  clearAllOfflineFiles(): Promise<void>;
  getSyncState(): Promise<SyncStateSummary>;
  getSyncStatus(): Promise<{ pendingChanges: number; hasFailedChanges: boolean }>;
  subscribeSyncChanges(listener: () => void): () => void;
  retrySync(userId?: string): Promise<void>;
  loadSampleSeedData(
    userId: string,
  ): Promise<{ classId: string; joinCode: string }>;
}

export interface CreateAppContainerOptions {
  databaseName?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

function resolveDocumentTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') {
    return preference;
  }
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }
  return 'light';
}

function applyDocumentTheme(preference: ThemePreference): void {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.dataset.theme = resolveDocumentTheme(preference);
  }
}

export function createAppContainer(
  options: CreateAppContainerOptions = {},
): AppContainer {
  const db = new LiteLearnDb(options.databaseName ?? 'litelearn_db');
  const supabaseConfig = resolveSupabaseConfigFromEnv(
    options.supabaseUrl,
    options.supabaseAnonKey,
  );
  const remote = supabaseConfig
    ? new SupabaseRemoteDataSource(
        createLazySupabaseClientLoader(supabaseConfig),
      )
    : null;
  const isLocalFallbackMode = remote === null;

  const authRepository = new HybridAuthRepository(db, remote);
  const classRepository = new HybridClassRepository(db, remote);
  const courseRepository = new HybridCourseRepository(db, remote);
  const weekRepository = new HybridWeekRepository(db, remote);
  const materialRepository = new HybridMaterialRepository(db, remote);
  const deadlineRepository = new HybridDeadlineRepository(db, remote);
  const announcementRepository = new HybridAnnouncementRepository(db, remote);
  const noteRepository = new DexieNoteRepository(db);
  const syncQueueRepository = new DexieSyncQueueRepository(db);

  const networkStatus = new BrowserNetworkStatusService({
    probeUrl: options.supabaseUrl?.trim() || null,
  });
  const syncService = new LiteLearnSyncService(
    db,
    syncQueueRepository,
    materialRepository,
    remote,
  );

  const initPromise =
    isLocalFallbackMode &&
    (!options.databaseName || options.databaseName === 'litelearn_db')
      ? seedInitialLocalDemo(db)
      : Promise.resolve();

  class LocalAwareListCourses extends ListCourses {
    override async execute(input: Parameters<ListCourses['execute']>[0]) {
      await initPromise;
      return super.execute(input);
    }
  }

  class LocalAwareGetUpcomingDeadlines extends GetUpcomingDeadlines {
    override async execute(
      input: Parameters<GetUpcomingDeadlines['execute']>[0],
    ) {
      await initPromise;
      return super.execute(input);
    }
  }

  class LocalAwareGetCourseWeeks extends GetCourseWeeks {
    override async execute(input: Parameters<GetCourseWeeks['execute']>[0]) {
      await initPromise;
      return super.execute(input);
    }
  }

  class LocalAwareListRecentAnnouncements extends ListRecentAnnouncements {
    override async execute(
      input: Parameters<ListRecentAnnouncements['execute']>[0],
    ) {
      await initPromise;
      return super.execute(input);
    }
  }

  class LocalAwareGetOfflineStudyOverview extends GetOfflineStudyOverview {
    override async execute(
      input: Parameters<GetOfflineStudyOverview['execute']>[0],
    ) {
      await initPromise;
      return super.execute(input);
    }
  }

  class LocalAwareSearchWorkspace extends SearchWorkspace {
    override async execute(input: Parameters<SearchWorkspace['execute']>[0]) {
      await initPromise;
      return super.execute(input);
    }
  }

  class LocalAwareSignIn extends SignIn {
    override async execute(input: Parameters<SignIn['execute']>[0]) {
      await initPromise;
      return super.execute(input);
    }
  }

  const usecases: AppUseCases = {
    signUp: new SignUp(authRepository),
    signIn: new LocalAwareSignIn(authRepository),
    signOut: new SignOut(authRepository),
    getCurrentUser: new GetCurrentUser(authRepository, classRepository),
    joinClass: new JoinClass(classRepository),
    createClass: new CreateClass(classRepository),
    listCourses: new LocalAwareListCourses(courseRepository),
    followCourse: new FollowCourse(courseRepository),
    unfollowCourse: new UnfollowCourse(courseRepository),
    getCourseWeeks: new LocalAwareGetCourseWeeks(
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
    downloadMaterialFile: new DownloadMaterialFile(materialRepository),
    getOfflineMaterialFile: new GetOfflineMaterialFile(materialRepository),
    removeOfflineMaterialFile: new RemoveOfflineMaterialFile(materialRepository),
    getOfflineStudyOverview: new LocalAwareGetOfflineStudyOverview(
      courseRepository,
      weekRepository,
      materialRepository,
      deadlineRepository,
    ),
    getMaterialNote: new GetMaterialNote(noteRepository),
    saveMaterialNote: new SaveMaterialNote(noteRepository, syncQueueRepository),
    getUpcomingDeadlines: new LocalAwareGetUpcomingDeadlines(
      courseRepository,
      deadlineRepository,
    ),
    listAnnouncements: new ListAnnouncements(announcementRepository),
    listRecentAnnouncements: new LocalAwareListRecentAnnouncements(
      courseRepository,
      announcementRepository,
    ),
    searchWorkspace: new LocalAwareSearchWorkspace(
      courseRepository,
      weekRepository,
      materialRepository,
      deadlineRepository,
      announcementRepository,
    ),
    runSync: new RunSync(syncService),
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
    networkStatus,
    isLocalFallbackMode,
    async getThemePreference(): Promise<ThemePreference | null> {
      const row = await db.meta.get(THEME_META_KEY);
      if (
        row?.value === 'system' ||
        row?.value === 'light' ||
        row?.value === 'dark'
      ) {
        applyDocumentTheme(row.value);
        return row.value;
      }
      return null;
    },
    async setThemePreference(theme: ThemePreference): Promise<void> {
      await db.meta.put({ key: THEME_META_KEY, value: theme });
      applyDocumentTheme(theme);
    },
    async getDataSaverEnabled(): Promise<boolean> {
      return syncService.getDataSaverEnabled();
    },
    async setDataSaverEnabled(enabled: boolean): Promise<void> {
      await syncService.setDataSaverEnabled(enabled);
    },
    async getOfflineStorageStats(): Promise<OfflineStorageStats> {
      return materialRepository.getOfflineStorageStats();
    },
    async clearAllOfflineFiles(): Promise<void> {
      await materialRepository.clearAllOfflineFiles();
    },
    async getSyncState(): Promise<SyncStateSummary> {
      return syncService.getSyncState();
    },
    async getSyncStatus(): Promise<{
      pendingChanges: number;
      hasFailedChanges: boolean;
    }> {
      const state = await syncService.getSyncState();
      return {
        pendingChanges: state.pendingCount,
        hasFailedChanges: state.hasFailedChanges,
      };
    },
    subscribeSyncChanges(listener: () => void): () => void {
      return db.subscribeSyncQueueChanges(listener);
    },
    async retrySync(userId?: string): Promise<void> {
      if (userId && userId.trim().length > 0) {
        await syncService.retryFailed(userId);
        return;
      }
      await syncQueueRepository.clearFailureState();
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
