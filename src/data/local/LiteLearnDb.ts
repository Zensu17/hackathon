import Dexie, { type Table } from 'dexie';
import type {
  SyncEntityType,
  SyncOperation,
  UserRole,
} from '../../domain/entities';

export interface LocalUserRow {
  id: string;
  nim: string;
  displayName: string;
  classId: string | null;
  role: UserRole | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface LocalSessionRow {
  id: 'current';
  userId: string;
  updatedAt: string;
}

export interface LocalCredentialRow {
  nim: string;
  userId: string;
  passwordHash: string;
  createdAt: string;
}

export interface LocalClassRow {
  id: string;
  name: string;
  joinCode: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface LocalCourseRow {
  id: string;
  classId: string;
  code: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface LocalCourseFollowRow {
  id: string;
  userId: string;
  courseId: string;
  createdAt: string;
}

export interface LocalWeekRow {
  id: string;
  courseId: string;
  weekNumber: number;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface LocalMaterialRow {
  id: string;
  courseId: string;
  weekId: string;
  title: string;
  description: string;
  externalUrl: string | null;
  attachmentName: string | null;
  attachmentSizeBytes: number | null;
  attachmentMimeType: string | null;
  attachmentStoragePath: string | null;
  attachmentRemoteUrl: string | null;
  isAvailableOffline: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface LocalMaterialBlobRow {
  materialId: string;
  blob: Uint8Array;
  mimeType: string;
  savedAt: string;
}

export interface LocalDeadlineRow {
  id: string;
  courseId: string;
  weekId: string | null;
  title: string;
  description: string;
  dueAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface LocalAnnouncementRow {
  id: string;
  courseId: string;
  title: string;
  body: string;
  postedAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface LocalNoteRow {
  id: string;
  userId: string;
  materialId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface LocalSyncQueueRow {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  payloadJson: string;
  attempts: number;
  lastError: string | null;
  nextRetryAt: string | null;
  createdAt: string;
}

export interface LocalMetaRow {
  key: string;
  value: string;
}

export class LiteLearnDb extends Dexie {
  declare users: Table<LocalUserRow, string>;
  declare sessions: Table<LocalSessionRow, 'current'>;
  declare localCredentials: Table<LocalCredentialRow, string>;
  declare classes: Table<LocalClassRow, string>;
  declare courses: Table<LocalCourseRow, string>;
  declare courseFollows: Table<LocalCourseFollowRow, string>;
  declare weeks: Table<LocalWeekRow, string>;
  declare materials: Table<LocalMaterialRow, string>;
  declare materialBlobs: Table<LocalMaterialBlobRow, string>;
  declare deadlines: Table<LocalDeadlineRow, string>;
  declare announcements: Table<LocalAnnouncementRow, string>;
  declare notes: Table<LocalNoteRow, string>;
  declare syncQueue: Table<LocalSyncQueueRow, string>;
  declare meta: Table<LocalMetaRow, string>;

  constructor(databaseName = 'litelearn_db') {
    super(databaseName);

    this.version(1).stores({
      users: 'id, email, classId, updatedAt',
      sessions: 'id, userId',
      localCredentials: 'email, userId',
      classes: 'id, joinCode, createdByUserId, updatedAt',
      courses: 'id, classId, code, updatedAt',
      courseFollows: 'id, userId, courseId, [userId+courseId]',
      weeks: 'id, courseId, weekNumber, updatedAt, [courseId+weekNumber]',
      materials: 'id, courseId, weekId, updatedAt',
      materialBlobs: 'materialId, savedAt',
      deadlines: 'id, courseId, weekId, dueAt, updatedAt',
      announcements: 'id, courseId, postedAt, updatedAt',
      notes: 'id, userId, materialId, updatedAt, [userId+materialId]',
      syncQueue: 'id, entityType, entityId, nextRetryAt, createdAt',
      meta: 'key',
    });

    this.version(2)
      .stores({
        users: 'id, nim, classId, updatedAt',
        localCredentials: null,
      })
      .upgrade(async (tx) => {
        await tx.table('users').clear();
        await tx.table('sessions').clear();
      });

    this.version(3).stores({
      localCredentials: 'nim, userId',
    });
  }

  override open(): ReturnType<Dexie['open']> {
    return super.open().catch(async (error: unknown) => {
      console.warn(
        'LiteLearnDb schema mismatch detected. Resetting database for v2...',
        error,
      );
      await this.delete();
      return super.open();
    }) as ReturnType<Dexie['open']>;
  }
}
