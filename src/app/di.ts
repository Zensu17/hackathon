import React from 'react';
import { AppError } from '../application/errors/AppError';
import {
  AdminCreateClass,
  AdminCreateUser,
  AdminResetPassword,
  AdminSetUserActive,
  AdminUpdateUser,
  ChangeOwnPassword,
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
  ToggleDeadlineCompletion,
  UnfollowCourse,
  UpdateAnnouncement,
  UpdateCourse,
  UpdateDeadline,
  UpdateMaterial,
  UpdateUserProfile,
  UpdateWeek,
} from '../application/usecases';
import type {
  AdminCreateClassDto,
  AdminCreateUserDto,
  AdminResetPasswordDto,
  AdminSetUserActiveDto,
  AdminUpdateUserDto,
  ChangeOwnPasswordDto,
  UpdateProfileInput,
} from '../application/dto';
import type { Class, User, UserRole } from '../domain/entities';
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
import { DexieDeadlineCompletionRepository } from '../data/repositories/DexieDeadlineCompletionRepository';
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
  listCompletedDeadlineIds(userId: string): Promise<string[]>;
  toggleDeadlineCompletion(
    userId: string,
    deadlineId: string,
    completed?: boolean,
  ): Promise<boolean>;
  subscribeDeadlineCompletions(listener: () => void): () => void;
  retrySync(userId?: string): Promise<void>;
  loadSampleSeedData(
    userId: string,
  ): Promise<{ classId: string; joinCode: string }>;
  updateProfile(input: UpdateProfileInput): Promise<User>;
  listClassMembers(classId: string): Promise<User[]>;
  updateMemberRole(
    actorId: string,
    targetUserId: string,
    nextRole: UserRole,
  ): Promise<User>;
  listAllUsers(actorId: string): Promise<User[]>;
  listAllClasses(actorId: string): Promise<Class[]>;
  adminCreateUser(input: AdminCreateUserDto): Promise<User>;
  adminUpdateUser(input: AdminUpdateUserDto): Promise<User>;
  adminSetUserActive(input: AdminSetUserActiveDto): Promise<User>;
  adminResetPassword(input: AdminResetPasswordDto): Promise<void>;
  adminCreateClass(input: AdminCreateClassDto): Promise<Class>;
  changeOwnPassword(input: ChangeOwnPasswordDto): Promise<void>;
  exportUserNotesMarkdown(userId: string): Promise<{
    fileName: string;
    markdown: string;
    noteCount: number;
    completedDeadlineCount: number;
  }>;
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
  const deadlineCompletionRepository = new DexieDeadlineCompletionRepository(db);
  const toggleDeadlineCompletionUseCase = new ToggleDeadlineCompletion(
    deadlineCompletionRepository,
  );
  const updateUserProfileUseCase = new UpdateUserProfile(authRepository);
  const adminCreateUserUseCase = new AdminCreateUser(authRepository);
  const adminUpdateUserUseCase = new AdminUpdateUser(authRepository);
  const adminSetUserActiveUseCase = new AdminSetUserActive(authRepository);
  const adminResetPasswordUseCase = new AdminResetPassword(authRepository);
  const adminCreateClassUseCase = new AdminCreateClass(authRepository);
  const changeOwnPasswordUseCase = new ChangeOwnPassword(authRepository);

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

  class LocalAwareSignUp extends SignUp {
    override async execute(input: Parameters<SignUp['execute']>[0]) {
      await initPromise;
      return super.execute(input);
    }
  }

  const usecases: AppUseCases = {
    signUp: new LocalAwareSignUp(authRepository),
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
    async listCompletedDeadlineIds(userId: string): Promise<string[]> {
      return deadlineCompletionRepository.listCompletedDeadlineIds(userId);
    },
    async toggleDeadlineCompletion(
      userId: string,
      deadlineId: string,
      completed?: boolean,
    ): Promise<boolean> {
      return toggleDeadlineCompletionUseCase.execute({
        userId,
        deadlineId,
        completed,
      });
    },
    subscribeDeadlineCompletions(listener: () => void): () => void {
      return db.subscribeDeadlineCompletions(listener);
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
    async updateProfile(input: UpdateProfileInput): Promise<User> {
      await initPromise;
      return updateUserProfileUseCase.execute(input);
    },
    async listClassMembers(classId: string): Promise<User[]> {
      await initPromise;
      return authRepository.listClassMembers(classId);
    },
    async updateMemberRole(
      actorId: string,
      targetUserId: string,
      nextRole: UserRole,
    ): Promise<User> {
      await initPromise;
      return adminUpdateUserUseCase.execute({
        actorId,
        targetUserId,
        role: nextRole,
      });
    },
    async listAllUsers(actorId: string): Promise<User[]> {
      await initPromise;
      return authRepository.listAllUsers(actorId);
    },
    async listAllClasses(actorId: string): Promise<Class[]> {
      await initPromise;
      return authRepository.listAllClasses(actorId);
    },
    async adminCreateUser(input: AdminCreateUserDto): Promise<User> {
      await initPromise;
      return adminCreateUserUseCase.execute(input);
    },
    async adminUpdateUser(input: AdminUpdateUserDto): Promise<User> {
      await initPromise;
      return adminUpdateUserUseCase.execute(input);
    },
    async adminSetUserActive(input: AdminSetUserActiveDto): Promise<User> {
      await initPromise;
      return adminSetUserActiveUseCase.execute(input);
    },
    async adminResetPassword(input: AdminResetPasswordDto): Promise<void> {
      await initPromise;
      return adminResetPasswordUseCase.execute(input);
    },
    async adminCreateClass(input: AdminCreateClassDto): Promise<Class> {
      await initPromise;
      return adminCreateClassUseCase.execute(input);
    },
    async changeOwnPassword(input: ChangeOwnPasswordDto): Promise<void> {
      await initPromise;
      return changeOwnPasswordUseCase.execute(input);
    },
    async exportUserNotesMarkdown(userId: string): Promise<{
      fileName: string;
      markdown: string;
      noteCount: number;
      completedDeadlineCount: number;
    }> {
      await initPromise;
      const trimmedUserId = userId.trim();
      const [userRow, rawNotes, rawCompletions] = await Promise.all([
        db.users.get(trimmedUserId),
        db.notes.where('userId').equals(trimmedUserId).toArray(),
        db.deadlineCompletions.where('userId').equals(trimmedUserId).toArray(),
      ]);

      const activeNotes = rawNotes.filter(
        (n) => n.deletedAt === null && n.body.trim().length > 0,
      );
      const materialIds = Array.from(
        new Set(activeNotes.map((n) => n.materialId)),
      );
      const deadlineIds = Array.from(
        new Set(rawCompletions.map((c) => c.deadlineId)),
      );

      const [materials, deadlines] = await Promise.all([
        materialIds.length > 0
          ? db.materials.where('id').anyOf(materialIds).toArray()
          : Promise.resolve([]),
        deadlineIds.length > 0
          ? db.deadlines.where('id').anyOf(deadlineIds).toArray()
          : Promise.resolve([]),
      ]);

      const courseIds = Array.from(
        new Set([
          ...materials.map((m) => m.courseId),
          ...deadlines.map((d) => d.courseId),
        ]),
      );
      const weekIds = Array.from(new Set(materials.map((m) => m.weekId)));

      const [courses, weeks] = await Promise.all([
        courseIds.length > 0
          ? db.courses.where('id').anyOf(courseIds).toArray()
          : Promise.resolve([]),
        weekIds.length > 0
          ? db.weeks.where('id').anyOf(weekIds).toArray()
          : Promise.resolve([]),
      ]);

      const materialById = new Map(materials.map((m) => [m.id, m]));
      const courseById = new Map(courses.map((c) => [c.id, c]));
      const weekById = new Map(weeks.map((w) => [w.id, w]));
      const deadlineById = new Map(deadlines.map((d) => [d.id, d]));

      const exportDate = new Date().toISOString().slice(0, 10);
      const studentName = userRow?.displayName ?? 'Student';
      const studentNim = userRow?.nim ?? 'LOCAL';

      const lines: string[] = [
        `# LiteLearn Study Backup (${studentName}, ${studentNim})`,
        '',
        `Exported: ${new Date().toISOString()}`,
        '',
        `## Private Study Notes (${activeNotes.length})`,
        '',
      ];

      if (activeNotes.length === 0) {
        lines.push('No personal study notes saved on this device yet.', '');
      } else {
        for (const note of activeNotes) {
          const mat = materialById.get(note.materialId);
          const course = mat ? courseById.get(mat.courseId) : undefined;
          const week = mat ? weekById.get(mat.weekId) : undefined;
          const headingParts = [
            course ? `${course.code} (${course.name})` : null,
            week ? `Week ${week.weekNumber}` : null,
            mat ? mat.title : `Material ${note.materialId}`,
          ].filter(Boolean);
          lines.push(`### ${headingParts.join(' / ')}`);
          lines.push(`Updated: ${note.updatedAt}`);
          lines.push('');
          lines.push(note.body.trim());
          lines.push('');
        }
      }

      lines.push(`## Completed Deadlines (${rawCompletions.length})`, '');
      if (rawCompletions.length === 0) {
        lines.push('No completed deadlines recorded yet.', '');
      } else {
        for (const completion of rawCompletions) {
          const dl = deadlineById.get(completion.deadlineId);
          const course = dl ? courseById.get(dl.courseId) : undefined;
          const label = dl
            ? `${course ? `${course.code}: ` : ''}${dl.title}`
            : `Deadline ${completion.deadlineId}`;
          lines.push(`- [x] ${label} (completed ${completion.completedAt})`);
        }
        lines.push('');
      }

      return {
        fileName: `litelearn-notes-${studentNim.toLowerCase()}-${exportDate}.md`,
        markdown: lines.join('\n'),
        noteCount: activeNotes.length,
        completedDeadlineCount: rawCompletions.length,
      };
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
