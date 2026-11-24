import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Course, Material, Note } from '../../domain/entities';
import { LiteLearnDb } from '../../data/local/LiteLearnDb';
import type { SupabaseRemoteDataSource } from '../../data/remote/SupabaseRemoteDataSource';
import { DexieSyncQueueRepository } from '../../data/repositories/DexieSyncQueueRepository';
import { HybridAuthRepository } from '../../data/repositories/HybridAuthRepository';
import { HybridCourseRepository } from '../../data/repositories/HybridCourseRepository';
import { HybridMaterialRepository } from '../../data/repositories/HybridMaterialRepository';
import {
  DATA_SAVER_META_KEY,
  fullHydrationCoursesKeyForUser,
  LAST_SYNC_META_KEY,
  lastSyncAtKeyForUser,
  lastSyncCursorKeyForUser,
  LiteLearnSyncService,
} from '../../data/services/LiteLearnSyncService';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../..');

interface MemoryTable<T extends Record<string, unknown>> {
  rows: Map<string, T>;
  get: (key: string) => Promise<T | undefined>;
  put: (row: T) => Promise<string>;
  bulkPut: (rows: T[]) => Promise<void>;
  delete: (key: string) => Promise<void>;
  bulkDelete: (keys: string[]) => Promise<void>;
  toArray: () => Promise<T[]>;
  count: () => Promise<number>;
  clear: () => Promise<void>;
  orderBy: (field: string) => { toArray: () => Promise<T[]> };
  where: (index: string) => {
    equals: (val: unknown) => {
      toArray: () => Promise<T[]>;
      first: () => Promise<T | undefined>;
      delete: () => Promise<number>;
      and: (pred: (row: T) => boolean) => { primaryKeys: () => Promise<string[]> };
    };
    anyOf: (vals: unknown[]) => {
      primaryKeys: () => Promise<string[]>;
      toArray: () => Promise<T[]>;
    };
  };
}

function createMemoryTable<T extends Record<string, unknown>>(
  keyField: string,
): MemoryTable<T> {
  const rows = new Map<string, T>();

  const matchIndex = (row: T, index: string, val: unknown): boolean => {
    if (index.startsWith('[') && index.endsWith(']') && Array.isArray(val)) {
      const fields = index.slice(1, -1).split('+');
      return fields.every((field, i) => row[field] === val[i]);
    }
    return row[index] === val;
  };

  return {
    rows,
    async get(key) {
      return rows.get(key);
    },
    async put(row) {
      const key = String(row[keyField]);
      rows.set(key, row);
      return key;
    },
    async bulkPut(list) {
      for (const item of list) {
        rows.set(String(item[keyField]), item);
      }
    },
    async delete(key) {
      rows.delete(key);
    },
    async bulkDelete(keys) {
      for (const k of keys) {
        rows.delete(k);
      }
    },
    async toArray() {
      return Array.from(rows.values());
    },
    async count() {
      return rows.size;
    },
    async clear() {
      rows.clear();
    },
    orderBy(field) {
      return {
        async toArray() {
          return Array.from(rows.values()).sort((a, b) =>
            String(a[field] ?? '').localeCompare(String(b[field] ?? '')),
          );
        },
      };
    },
    where(index) {
      return {
        equals(val) {
          const matches = () =>
            Array.from(rows.values()).filter((r) => matchIndex(r, index, val));
          return {
            async toArray() {
              return matches();
            },
            async first() {
              return matches()[0];
            },
            async delete() {
              const found = matches();
              for (const item of found) {
                rows.delete(String(item[keyField]));
              }
              return found.length;
            },
            and(pred) {
              return {
                async primaryKeys() {
                  return matches()
                    .filter(pred)
                    .map((r) => String(r[keyField]));
                },
              };
            },
          };
        },
        anyOf(vals) {
          const set = new Set(vals);
          const matches = () =>
            Array.from(rows.values()).filter((r) => set.has(r[index]));
          return {
            async primaryKeys() {
              return matches().map((r) => String(r[keyField]));
            },
            async toArray() {
              return matches();
            },
          };
        },
      };
    },
  };
}

function createFakeDb() {
  return {
    users: createMemoryTable<Record<string, unknown>>('id'),
    sessions: createMemoryTable<Record<string, unknown>>('id'),
    localCredentials: createMemoryTable<Record<string, unknown>>('nim'),
    classes: createMemoryTable<Record<string, unknown>>('id'),
    courses: createMemoryTable<Record<string, unknown>>('id'),
    courseFollows: createMemoryTable<Record<string, unknown>>('id'),
    weeks: createMemoryTable<Record<string, unknown>>('id'),
    materials: createMemoryTable<Record<string, unknown>>('id'),
    materialBlobs: createMemoryTable<Record<string, unknown>>('materialId'),
    deadlines: createMemoryTable<Record<string, unknown>>('id'),
    announcements: createMemoryTable<Record<string, unknown>>('id'),
    notes: createMemoryTable<Record<string, unknown>>('id'),
    syncQueue: createMemoryTable<Record<string, unknown>>('id'),
    meta: createMemoryTable<Record<string, unknown>>('key'),
    deadlineCompletions: createMemoryTable<Record<string, unknown>>('id'),
    notifySyncQueueChanged: vi.fn(),
    notifyDeadlineCompletionsChanged: vi.fn(),
    async transaction(_mode: string, _tables: unknown, fn: () => Promise<unknown>) {
      return fn();
    },
  };
}

const VALID_PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

describe('Sync Queue, Offline Resilience, Security, and Critical Fix Regressions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('orders pending sync items by createdAt, skips future backoff items, and coalesces superseded edits', async () => {
    // Arrange
    const db = createFakeDb();
    const queueRepo = new DexieSyncQueueRepository(db as unknown as LiteLearnDb);

    // Act
    const first = await queueRepo.enqueue({
      userId: 'user-1',
      entityType: 'course',
      entityId: 'course-1',
      operation: 'upsert',
      payloadJson: JSON.stringify({ id: 'course-1', name: 'Draft v1' }),
    });
    await queueRepo.markFailed(
      first.id,
      'Network error',
      '2099-01-01T00:00:00.000Z',
    );

    // Backed-off item is skipped when nowIso < nextRetryAt.
    expect(await queueRepo.listPending('2026-11-24T09:00:00.000Z')).toHaveLength(0);

    // Enqueuing a newer edit for the same entity coalesces and replaces the backed-off v1 edit (CR-03).
    const second = await queueRepo.enqueue({
      userId: 'user-1',
      entityType: 'course',
      entityId: 'course-1',
      operation: 'upsert',
      payloadJson: JSON.stringify({ id: 'course-1', name: 'Draft v2' }),
    });

    // Assert
    expect(await queueRepo.countPending()).toBe(1);
    const pending = await queueRepo.listPending('2026-11-24T09:00:00.000Z');
    expect(pending).toHaveLength(1);
    expect(pending[0]?.id).toBe(second.id);
    expect(JSON.parse(pending[0]!.payloadJson).name).toBe('Draft v2');
  });

  it('preserves lastSyncAt on mid-sync push failure, schedules backoff, and recovers on retryFailed', async () => {
    // Arrange
    const db = createFakeDb();
    await db.users.put({
      id: 'user-1',
      classId: 'class-1',
      nim: '11S22001',
      displayName: 'Student',
      role: 'student',
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      deletedAt: null,
    });
    await db.meta.put({
      key: lastSyncCursorKeyForUser('user-1'),
      value: '2026-11-22T08:00:00.000Z',
    });

    const queueRepo = new DexieSyncQueueRepository(db as unknown as LiteLearnDb);
    await queueRepo.enqueue({
      userId: 'user-1',
      entityType: 'note',
      entityId: 'note-1',
      operation: 'upsert',
      payloadJson: JSON.stringify({
        id: 'note-1',
        userId: 'user-1',
        materialId: 'mat-1',
        body: 'Study trees',
        updatedAt: '2026-11-23T09:00:00.000Z',
      }),
    });

    const upsertNote = vi
      .fn()
      .mockRejectedValueOnce(new Error('Dorm Wi-Fi timeout'))
      .mockResolvedValueOnce(undefined);

    const fakeRemote = {
      upsertNote,
      fetchCoursesByClassId: vi.fn(async () => []),
      fetchFollowedCoursesContent: vi.fn(async () => ({
        weeks: [],
        materials: [],
        deadlines: [],
        announcements: [],
      })),
      fetchUserNotes: vi.fn(async () => []),
    } as unknown as SupabaseRemoteDataSource;

    const materialRepo = new HybridMaterialRepository(
      db as unknown as LiteLearnDb,
      fakeRemote,
    );
    const syncService = new LiteLearnSyncService(
      db as unknown as LiteLearnDb,
      queueRepo,
      materialRepo,
      fakeRemote,
    );

    // Act 1: First sync fails push
    const failedState = await syncService.syncNow('user-1');

    // Assert 1: Cursor preserved, item still in queue with attempts = 1 & error recorded
    expect(failedState.isSyncing).toBe(false);
    expect(failedState.pendingCount).toBe(1);
    expect(failedState.hasFailedChanges).toBe(true);
    expect(failedState.lastError).toContain('Dorm Wi-Fi timeout');
    expect((await db.meta.get(lastSyncCursorKeyForUser('user-1')))?.value).toBe(
      '2026-11-22T08:00:00.000Z',
    );

    // Act 2: retryFailed clears backoff and pushes note with client updatedAt preserved (CR-03)
    const recoveredState = await syncService.retryFailed('user-1');

    // Assert 2
    expect(recoveredState.isSyncing).toBe(false);
    expect(recoveredState.pendingCount).toBe(0);
    expect(recoveredState.hasFailedChanges).toBe(false);
    expect(upsertNote).toHaveBeenLastCalledWith({
      userId: 'user-1',
      materialId: 'mat-1',
      body: 'Study trees',
      updatedAt: '2026-11-23T09:00:00.000Z',
    });
  });

  it('returns isSyncing: false in local fallback mode and respects Data Saver prefetch rules', async () => {
    // Arrange
    const db = createFakeDb();
    await db.courseFollows.put({
      id: 'cf-1',
      userId: 'user-1',
      courseId: 'course-1',
      createdAt: '2026-11-20T00:00:00.000Z',
    });
    await db.courses.put({
      id: 'course-1',
      classId: 'class-1',
      code: 'IF101',
      name: 'Algorithms',
      description: '',
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      deletedAt: null,
    });
    await db.materials.put({
      id: 'mat-small',
      courseId: 'course-1',
      weekId: 'week-1',
      title: 'Small Handout',
      description: 'Under 1 MB',
      externalUrl: null,
      attachmentName: 'small.pdf',
      attachmentSizeBytes: 500_000,
      attachmentMimeType: 'application/pdf',
      attachmentStoragePath: 'class-1/course-1/mat-small/small.pdf',
      attachmentRemoteUrl: null,
      isAvailableOffline: false,
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      deletedAt: null,
    });
    await db.materials.put({
      id: 'mat-large',
      courseId: 'course-1',
      weekId: 'week-1',
      title: 'Large Textbook',
      description: 'Over 1 MB',
      externalUrl: null,
      attachmentName: 'large.pdf',
      attachmentSizeBytes: 2_500_000,
      attachmentMimeType: 'application/pdf',
      attachmentStoragePath: 'class-1/course-1/mat-large/large.pdf',
      attachmentRemoteUrl: null,
      isAvailableOffline: false,
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      deletedAt: null,
    });

    const queueRepo = new DexieSyncQueueRepository(db as unknown as LiteLearnDb);
    const materialRepo = new HybridMaterialRepository(
      db as unknown as LiteLearnDb,
      null,
    );
    const syncService = new LiteLearnSyncService(
      db as unknown as LiteLearnDb,
      queueRepo,
      materialRepo,
      null,
    );

    // Act 1: Default Data Saver ON -> zero PDFs auto-downloaded, isSyncing is false (UI CR-04)
    const stateOn = await syncService.syncNow('user-1');
    expect(stateOn.isSyncing).toBe(false);
    expect(stateOn.mode).toBe('local');
    expect(await db.materialBlobs.get('mat-small')).toBeUndefined();
    expect(await db.materialBlobs.get('mat-large')).toBeUndefined();

    // Act 2: Data Saver OFF -> sub-1 MB PDF prefetched, >= 1 MB stays manual
    await db.meta.put({ key: DATA_SAVER_META_KEY, value: 'false' });
    const stateOff = await syncService.syncNow('user-1');
    expect(stateOff.isSyncing).toBe(false);
    expect(await db.materialBlobs.get('mat-small')).toBeDefined();
    expect(await db.materialBlobs.get('mat-large')).toBeUndefined();
  });

  it('isolates syncQueue and last_sync_at per user across default signOut (CORE CR-05)', async () => {
    // Arrange
    const db = createFakeDb();
    await db.sessions.put({
      id: 'current',
      userId: 'user-a',
      updatedAt: '2026-11-23T08:00:00.000Z',
    });
    await db.users.put({
      id: 'user-b',
      classId: 'class-1',
      nim: '11S22002',
      displayName: 'User B',
      role: 'student',
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      deletedAt: null,
    });
    // Legacy unscoped queue item & unscoped last_sync_at left by User A before signOut
    await db.syncQueue.put({
      id: 'q-user-a',
      entityType: 'course',
      entityId: 'course-a',
      operation: 'upsert',
      payloadJson: JSON.stringify({ id: 'course-a', name: 'Secret Draft' }),
      attempts: 0,
      lastError: null,
      nextRetryAt: null,
      createdAt: '2026-11-23T08:05:00.000Z',
    });
    await db.meta.put({
      key: LAST_SYNC_META_KEY,
      value: '2026-11-23T08:00:00.000Z',
    });

    const upsertCoursePayload = vi.fn(async () => undefined);
    const fetchCoursesByClassId = vi.fn(async () => []);
    const fakeRemote = {
      signOut: vi.fn(async () => undefined),
      upsertCoursePayload,
      fetchCoursesByClassId,
      fetchFollowedCoursesContent: vi.fn(async () => ({
        weeks: [],
        materials: [],
        deadlines: [],
        announcements: [],
      })),
      fetchUserNotes: vi.fn(async () => []),
    } as unknown as SupabaseRemoteDataSource;

    const authRepo = new HybridAuthRepository(
      db as unknown as LiteLearnDb,
      fakeRemote,
    );
    const queueRepo = new DexieSyncQueueRepository(db as unknown as LiteLearnDb);
    const materialRepo = new HybridMaterialRepository(
      db as unknown as LiteLearnDb,
      fakeRemote,
    );
    const syncService = new LiteLearnSyncService(
      db as unknown as LiteLearnDb,
      queueRepo,
      materialRepo,
      fakeRemote,
    );

    // Act: User A signs out with default options, then User B syncs
    await authRepo.signOut();
    await db.sessions.put({
      id: 'current',
      userId: 'user-b',
      updatedAt: '2026-11-23T09:00:00.000Z',
    });
    const stateB = await syncService.syncNow('user-b');

    // Assert: User A's queue item is NOT pushed under User B and User B pulls full initial sync (sinceIso = null)
    expect(upsertCoursePayload).not.toHaveBeenCalled();
    expect(fetchCoursesByClassId).toHaveBeenCalledWith('class-1', null);
    expect(stateB.pendingCount).toBe(0);
    expect((await db.syncQueue.get('q-user-a'))?.userId).toBe('user-a');
  });

  it('reconciles remote notes by [userId+materialId] without creating duplicate UUID rows (CORE CR-02)', async () => {
    // Arrange
    const db = createFakeDb();
    await db.users.put({
      id: 'user-1',
      classId: 'class-1',
      nim: '11S22001',
      displayName: 'Student',
      role: 'student',
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      deletedAt: null,
    });
    await db.notes.put({
      id: '00000000-local-uuid',
      userId: 'user-1',
      materialId: 'mat-1',
      body: 'Older local version',
      createdAt: '2026-11-22T08:00:00.000Z',
      updatedAt: '2026-11-22T08:00:00.000Z',
      deletedAt: null,
    });

    const remoteNote: Note = {
      id: 'ffffffff-remote-uuid',
      userId: 'user-1',
      materialId: 'mat-1',
      body: 'Newer server version',
      createdAt: '2026-11-22T08:00:00.000Z',
      updatedAt: '2026-11-23T10:00:00.000Z',
      deletedAt: null,
    };

    const fakeRemote = {
      fetchCoursesByClassId: vi.fn(async () => []),
      fetchFollowedCoursesContent: vi.fn(async () => ({
        weeks: [],
        materials: [],
        deadlines: [],
        announcements: [],
      })),
      fetchUserNotes: vi.fn(async () => [remoteNote]),
    } as unknown as SupabaseRemoteDataSource;

    const syncService = new LiteLearnSyncService(
      db as unknown as LiteLearnDb,
      new DexieSyncQueueRepository(db as unknown as LiteLearnDb),
      new HybridMaterialRepository(db as unknown as LiteLearnDb, fakeRemote),
      fakeRemote,
    );

    // Act
    await syncService.syncNow('user-1');

    // Assert: Only 1 note row exists for [user-1, mat-1] and it has the remote UUID & newer body
    const notes = await db.notes.toArray();
    expect(notes).toHaveLength(1);
    expect(notes[0]?.id).toBe('ffffffff-remote-uuid');
    expect(notes[0]?.body).toBe('Newer server version');
  });

  it('prevents delta pull from overwriting pending local rep edits or newer local updatedAt (CORE CR-03)', async () => {
    // Arrange
    const db = createFakeDb();
    await db.users.put({
      id: 'rep-1',
      classId: 'class-1',
      nim: '11S22002',
      displayName: 'Rep',
      role: 'rep',
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      deletedAt: null,
    });
    await db.courses.put({
      id: 'course-pending',
      classId: 'class-1',
      code: 'IF101',
      name: 'Local Pending Course Rename',
      description: '',
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-23T10:00:00.000Z',
      deletedAt: null,
    });
    // Backed-off pending queue entry (skipped by listPending due to future nextRetryAt)
    await db.syncQueue.put({
      id: 'q-course-1',
      userId: 'rep-1',
      entityType: 'course',
      entityId: 'course-pending',
      operation: 'upsert',
      payloadJson: JSON.stringify({ id: 'course-pending' }),
      attempts: 1,
      lastError: 'Temporary error',
      nextRetryAt: '2099-01-01T00:00:00.000Z',
      createdAt: '2026-11-23T10:00:00.000Z',
    });

    const staleRemoteCourse: Course = {
      id: 'course-pending',
      classId: 'class-1',
      code: 'IF101',
      name: 'Old Server Course Name',
      description: '',
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-23T11:00:00.000Z',
      deletedAt: null,
    };

    const fakeRemote = {
      fetchCoursesByClassId: vi.fn(async () => [staleRemoteCourse]),
      fetchFollowedCoursesContent: vi.fn(async () => ({
        weeks: [],
        materials: [],
        deadlines: [],
        announcements: [],
      })),
      fetchUserNotes: vi.fn(async () => []),
    } as unknown as SupabaseRemoteDataSource;

    const syncService = new LiteLearnSyncService(
      db as unknown as LiteLearnDb,
      new DexieSyncQueueRepository(db as unknown as LiteLearnDb),
      new HybridMaterialRepository(db as unknown as LiteLearnDb, fakeRemote),
      fakeRemote,
    );

    // Act
    await syncService.syncNow('rep-1');

    // Assert: Pending local edit was NOT clobbered by remote pull
    expect((await db.courses.get('course-pending'))?.name).toBe(
      'Local Pending Course Rename',
    );
  });

  it('retains full-hydration marker across mid-sync pull failure and uses server watermark before prefetch (CORE CR-04)', async () => {
    // Arrange
    const db = createFakeDb();
    await db.users.put({
      id: 'user-1',
      classId: 'class-1',
      nim: '11S22001',
      displayName: 'Student',
      role: 'student',
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      deletedAt: null,
    });
    await db.meta.put({
      key: lastSyncCursorKeyForUser('user-1'),
      value: '2026-11-22T10:00:00.000Z',
    });

    const insertCourseFollow = vi
      .fn()
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValue({
        id: 'cf-2',
        userId: 'user-1',
        courseId: 'course-new',
        createdAt: '2026-11-23T09:00:00.000Z',
      });

    const fetchFollowedCoursesContent = vi
      .fn()
      .mockRejectedValueOnce(new Error('Wi-Fi dropped during pull'))
      .mockResolvedValueOnce({
        weeks: [
          {
            id: 'week-old',
            courseId: 'course-new',
            weekNumber: 1,
            title: 'Week 1',
            summary: '',
            createdAt: '2026-10-01T00:00:00.000Z',
            updatedAt: '2026-11-23T09:15:00.000Z',
            deletedAt: null,
          },
        ],
        materials: [],
        deadlines: [],
        announcements: [],
      });

    const fakeRemote = {
      insertCourseFollow,
      fetchCoursesByClassId: vi.fn(async () => []),
      fetchFollowedCoursesContent,
      fetchUserNotes: vi.fn(async () => []),
    } as unknown as SupabaseRemoteDataSource;

    const courseRepo = new HybridCourseRepository(
      db as unknown as LiteLearnDb,
      fakeRemote,
    );
    const syncService = new LiteLearnSyncService(
      db as unknown as LiteLearnDb,
      new DexieSyncQueueRepository(db as unknown as LiteLearnDb),
      new HybridMaterialRepository(db as unknown as LiteLearnDb, fakeRemote),
      fakeRemote,
    );

    // Act 1: Offline follow queues course_follow
    await courseRepo.followCourse('user-1', 'course-new');
    // Act 2: First sync pushes follow (deletes queue item), then pull fails
    const firstResult = await syncService.syncNow('user-1');
    expect(firstResult.lastError).toContain('Wi-Fi dropped during pull');
    expect(await db.meta.get(fullHydrationCoursesKeyForUser('user-1'))).toBeDefined();

    // Act 3: Second sync retries pull and STILL requests sinceIso = null for course-new
    const secondResult = await syncService.syncNow('user-1');

    // Assert
    expect(secondResult.lastError).toBeNull();
    expect(fetchFollowedCoursesContent).toHaveBeenNthCalledWith(
      2,
      ['course-new'],
      null,
    );
    expect(
      await db.meta.get(fullHydrationCoursesKeyForUser('user-1')),
    ).toBeUndefined();
    expect((await db.meta.get(lastSyncCursorKeyForUser('user-1')))?.value).toBe(
      '2026-11-23T09:15:00.000Z',
    );
    expect(await db.meta.get(lastSyncAtKeyForUser('user-1'))).toBeDefined();
  });

  it('rejects non-PDF HTTP Content-Type and HTML/SVG payloads during remote PDF download (CORE CR-01)', async () => {
    // Arrange
    const db = createFakeDb();
    const fakeRemote = {
      getSignedMaterialUrl: vi.fn(async () => 'https://captive-portal.local/login'),
    } as unknown as SupabaseRemoteDataSource;
    const materialRepo = new HybridMaterialRepository(
      db as unknown as LiteLearnDb,
      fakeRemote,
    );

    const material: Material = {
      id: 'mat-1',
      courseId: 'course-1',
      weekId: 'week-1',
      title: 'Slides',
      description: '',
      externalUrl: null,
      attachment: {
        name: 'slides.pdf',
        sizeBytes: 100,
        mimeType: 'application/pdf',
        storagePath: 'class-1/course-1/mat-1/slides.pdf',
        remoteUrl: null,
      },
      isAvailableOffline: false,
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      deletedAt: null,
    };

    const htmlBytes = new TextEncoder().encode('<html><script>alert(1)</script></html>');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        headers: { get: () => 'text/html; charset=utf-8' },
        arrayBuffer: async () => htmlBytes.buffer,
      })),
    );

    // Act & Assert 1: Rejects text/html response
    await expect(materialRepo.downloadRemoteFile(material)).rejects.toMatchObject({
      code: 'INVALID_FILE_TYPE',
    });

    // Act & Assert 2: Rejects spoofed application/pdf header with SVG body
    const svgBytes = new TextEncoder().encode('<svg onload="alert(1)"></svg>');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        headers: { get: () => 'application/pdf' },
        arrayBuffer: async () => svgBytes.buffer,
      })),
    );
    await expect(materialRepo.downloadRemoteFile(material)).rejects.toMatchObject({
      code: 'INVALID_FILE_TYPE',
    });

    // Act & Assert 3: Rejects non-PDF bytes in saveOfflineFile directly
    await db.materials.put({
      id: 'mat-1',
      courseId: 'course-1',
      weekId: 'week-1',
      title: 'Slides',
      description: '',
      externalUrl: null,
      attachmentName: 'slides.pdf',
      attachmentSizeBytes: 100,
      attachmentMimeType: 'application/pdf',
      attachmentStoragePath: 'class-1/course-1/mat-1/slides.pdf',
      attachmentRemoteUrl: null,
      isAvailableOffline: false,
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      deletedAt: null,
    });
    await expect(
      materialRepo.saveOfflineFile('mat-1', htmlBytes, 'text/html'),
    ).rejects.toMatchObject({ code: 'INVALID_FILE_TYPE' });
  });

  it('protects pending-upload PDF blobs from eviction and fails loudly if a pending blob is missing (CORE CR-09)', async () => {
    // Arrange
    const db = createFakeDb();
    await db.users.put({
      id: 'rep-1',
      classId: 'class-1',
      nim: '11S22002',
      displayName: 'Rep',
      role: 'rep',
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      deletedAt: null,
    });
    await db.courses.put({
      id: 'course-1',
      classId: 'class-1',
      code: 'IF101',
      name: 'Algorithms',
      description: '',
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      deletedAt: null,
    });

    const upsertMaterialPayload = vi.fn(async () => undefined);
    const fakeRemote = {
      createMaterial: vi.fn(async () => {
        throw new Error('Failed to fetch');
      }),
      upsertMaterialPayload,
      fetchCoursesByClassId: vi.fn(async () => []),
      fetchFollowedCoursesContent: vi.fn(async () => ({
        weeks: [],
        materials: [],
        deadlines: [],
        announcements: [],
      })),
      fetchUserNotes: vi.fn(async () => []),
    } as unknown as SupabaseRemoteDataSource;

    const materialRepo = new HybridMaterialRepository(
      db as unknown as LiteLearnDb,
      fakeRemote,
    );

    const created = await materialRepo.create({
      courseId: 'course-1',
      weekId: 'week-1',
      title: 'Offline Handout',
      description: '',
      externalUrl: null,
      file: {
        name: 'handout.pdf',
        sizeBytes: VALID_PDF_BYTES.byteLength,
        mimeType: 'application/pdf',
        bytes: VALID_PDF_BYTES,
      },
    });

    // Act & Assert 1: removeOfflineFile blocks deleting a blob queued for upload
    await expect(materialRepo.removeOfflineFile(created.id)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });

    // Act & Assert 2: clearAllOfflineFiles preserves pending upload blob
    await materialRepo.clearAllOfflineFiles();
    expect(await db.materialBlobs.get(created.id)).toBeDefined();

    // Act & Assert 3: If blob is externally missing during sync, push fails loudly without upserting a dangling path
    await db.materialBlobs.delete(created.id);
    const syncService = new LiteLearnSyncService(
      db as unknown as LiteLearnDb,
      new DexieSyncQueueRepository(db as unknown as LiteLearnDb),
      materialRepo,
      fakeRemote,
    );
    const syncState = await syncService.syncNow('rep-1');
    expect(syncState.hasFailedChanges).toBe(true);
    expect(upsertMaterialPayload).not.toHaveBeenCalled();
  });

  it('does not delete a same-named replacement PDF on offline update sync (CORE CR-09 & UI CR-03)', async () => {
    // Arrange
    const db = createFakeDb();
    await db.users.put({
      id: 'rep-1',
      classId: 'class-1',
      nim: '11S22002',
      displayName: 'Rep',
      role: 'rep',
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      deletedAt: null,
    });
    await db.courses.put({
      id: 'course-1',
      classId: 'class-1',
      code: 'IF101',
      name: 'Algorithms',
      description: '',
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      deletedAt: null,
    });
    await db.materials.put({
      id: 'mat-1',
      courseId: 'course-1',
      weekId: 'week-1',
      title: 'Week 1',
      description: '',
      externalUrl: null,
      attachmentName: 'week1.pdf',
      attachmentSizeBytes: 8,
      attachmentMimeType: 'application/pdf',
      attachmentStoragePath: 'class-1/course-1/mat-1/week1.pdf',
      attachmentRemoteUrl: null,
      isAvailableOffline: true,
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      deletedAt: null,
    });

    const uploadMaterialPdf = vi.fn(async () => ({
      storagePath: 'class-1/course-1/mat-1/week1.pdf',
      remoteUrl: 'https://signed.example/week1.pdf',
    }));
    const deleteMaterialPdf = vi.fn(async () => undefined);
    const upsertMaterialPayload = vi.fn(async () => undefined);

    const fakeRemote = {
      updateMaterial: vi.fn(async () => {
        throw new Error('Failed to fetch');
      }),
      uploadMaterialPdf,
      deleteMaterialPdf,
      upsertMaterialPayload,
      fetchCoursesByClassId: vi.fn(async () => []),
      fetchFollowedCoursesContent: vi.fn(async () => ({
        weeks: [],
        materials: [],
        deadlines: [],
        announcements: [],
      })),
      fetchUserNotes: vi.fn(async () => []),
    } as unknown as SupabaseRemoteDataSource;

    const materialRepo = new HybridMaterialRepository(
      db as unknown as LiteLearnDb,
      fakeRemote,
    );

    // Act: Offline update passes BOTH removeAttachment: true AND a replacement file with the same filename
    await materialRepo.update('mat-1', {
      weekId: 'week-1',
      title: 'Week 1 Revised',
      description: '',
      externalUrl: null,
      removeAttachment: true,
      file: {
        name: 'week1.pdf',
        sizeBytes: VALID_PDF_BYTES.byteLength,
        mimeType: 'application/pdf',
        bytes: VALID_PDF_BYTES,
      },
    });

    const syncService = new LiteLearnSyncService(
      db as unknown as LiteLearnDb,
      new DexieSyncQueueRepository(db as unknown as LiteLearnDb),
      materialRepo,
      fakeRemote,
    );
    await syncService.syncNow('rep-1');

    // Assert: Replacement file was uploaded, NOT deleted, and removeAttachment was normalized to false
    expect(uploadMaterialPdf).toHaveBeenCalledTimes(1);
    expect(deleteMaterialPdf).not.toHaveBeenCalled();
    expect(upsertMaterialPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        attachmentStoragePath: 'class-1/course-1/mat-1/week1.pdf',
        removeAttachment: false,
      }),
    );
  });

  it('invalidates stale cached PDF blobs when delta pull detects a replaced or removed attachment (CORE CR-09)', async () => {
    // Arrange
    const db = createFakeDb();
    await db.users.put({
      id: 'user-1',
      classId: 'class-1',
      nim: '11S22001',
      displayName: 'Student',
      role: 'student',
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      deletedAt: null,
    });
    await db.courseFollows.put({
      id: 'cf-1',
      userId: 'user-1',
      courseId: 'course-1',
      createdAt: '2026-11-20T00:00:00.000Z',
    });
    await db.materials.put({
      id: 'mat-1',
      courseId: 'course-1',
      weekId: 'week-1',
      title: 'Slides v1',
      description: '',
      externalUrl: null,
      attachmentName: 'v1.pdf',
      attachmentSizeBytes: 8,
      attachmentMimeType: 'application/pdf',
      attachmentStoragePath: 'class-1/course-1/mat-1/v1.pdf',
      attachmentRemoteUrl: null,
      isAvailableOffline: true,
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      deletedAt: null,
    });
    await db.materialBlobs.put({
      materialId: 'mat-1',
      blob: VALID_PDF_BYTES,
      mimeType: 'application/pdf',
      savedAt: '2026-11-20T00:00:00.000Z',
    });

    const updatedRemoteMaterial: Material = {
      id: 'mat-1',
      courseId: 'course-1',
      weekId: 'week-1',
      title: 'Slides v2',
      description: '',
      externalUrl: null,
      attachment: {
        name: 'v2.pdf',
        sizeBytes: 120_000,
        mimeType: 'application/pdf',
        storagePath: 'class-1/course-1/mat-1/v2.pdf',
        remoteUrl: null,
      },
      isAvailableOffline: false,
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-23T12:00:00.000Z',
      deletedAt: null,
    };

    const fakeRemote = {
      fetchCoursesByClassId: vi.fn(async () => []),
      fetchFollowedCoursesContent: vi.fn(async () => ({
        weeks: [],
        materials: [updatedRemoteMaterial],
        deadlines: [],
        announcements: [],
      })),
      fetchUserNotes: vi.fn(async () => []),
    } as unknown as SupabaseRemoteDataSource;

    const syncService = new LiteLearnSyncService(
      db as unknown as LiteLearnDb,
      new DexieSyncQueueRepository(db as unknown as LiteLearnDb),
      new HybridMaterialRepository(db as unknown as LiteLearnDb, fakeRemote),
      fakeRemote,
    );

    // Act
    await syncService.syncNow('user-1');

    // Assert: Stale v1 blob was evicted and isAvailableOffline reset to false
    expect(await db.materialBlobs.get('mat-1')).toBeUndefined();
    expect((await db.materials.get('mat-1'))?.isAvailableOffline).toBe(false);
    expect((await db.materials.get('mat-1'))?.attachmentName).toBe('v2.pdf');
  });

  it('hydrates local classes and courses after remote SignUp (CORE CR-06)', async () => {
    // Arrange
    const db = createFakeDb();
    const remoteClass = {
      id: 'class-9',
      name: 'IF 2026',
      joinCode: 'IF2026',
      createdByUserId: 'rep-9',
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      deletedAt: null,
    };
    const remoteCourse: Course = {
      id: 'course-9',
      classId: 'class-9',
      code: 'IF1101',
      name: 'Algorithms',
      description: 'Core CS',
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      deletedAt: null,
    };

    const fakeRemote = {
      signUp: vi.fn(async () => ({
        user: {
          id: 'student-9',
          nim: '11S22009',
          displayName: 'Student Nine',
          classId: 'class-9',
          role: 'student' as const,
          createdAt: '2026-11-23T08:00:00.000Z',
          updatedAt: '2026-11-23T08:00:00.000Z',
          deletedAt: null,
        },
        currentClass: remoteClass,
      })),
      fetchCoursesByClassId: vi.fn(async () => [remoteCourse]),
    } as unknown as SupabaseRemoteDataSource;

    const authRepo = new HybridAuthRepository(
      db as unknown as LiteLearnDb,
      fakeRemote,
    );

    // Act
    const createdUser = await authRepo.signUp({
      nim: '11S22009',
      password: 'password123',
      displayName: 'Student Nine',
      classCode: 'IF2026',
    });

    // Assert: Local users, sessions, classes, and courses are all hydrated immediately
    expect(createdUser.classId).toBe('class-9');
    expect((await db.classes.get('class-9'))?.joinCode).toBe('IF2026');
    expect((await db.courses.get('course-9'))?.code).toBe('IF1101');
    expect((await db.sessions.get('current'))?.userId).toBe('student-9');
  });

  it('never wipes IndexedDB on VersionError or UpgradeError in LiteLearnDb.open() (CORE CR-08)', async () => {
    // Arrange
    const db = new LiteLearnDb('litelearn_non_destructive_open_test');
    const versionErr = Object.assign(new Error('Database version is newer'), {
      name: 'VersionError',
    });
    vi.spyOn(Dexie.prototype, 'open').mockRejectedValueOnce(versionErr);
    const deleteSpy = vi.spyOn(db, 'delete').mockResolvedValue(undefined);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    // Act & Assert
    await expect(db.open()).rejects.toBe(versionErr);
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('ships Migration 004 revoking material_class_id from PUBLIC, enforcing LWW, and hardening NIM derivation (CORE CR-07)', () => {
    // Arrange
    const sqlPath = path.join(
      repoRoot,
      'supabase',
      'migrations',
      '004_security_and_sync_fixes.sql',
    );

    // Act
    const sql = fs.readFileSync(sqlPath, 'utf8').toLowerCase();

    // Assert
    expect(sql).toContain(
      'revoke all on function public.material_class_id(uuid) from public;',
    );
    expect(sql).toContain(
      'revoke all on function public.material_class_id(uuid) from anon, authenticated;',
    );
    expect(sql).toContain('create trigger trg_notes_lww');
    expect(sql).toContain("'%@nim.litelearn.local'");
    expect(sql).toContain('profiles_nim_format_check');
    expect(sql).toContain('create or replace function public.check_class_join_code');
  });

  it('enforces student role on all local signups including custom class creation and rejects invalid class codes', async () => {
    const db = createFakeDb();
    const authRepo = new HybridAuthRepository(
      db as unknown as LiteLearnDb,
      null,
    );

    const sampleStudent = await authRepo.signUp({
      nim: '11S24001',
      displayName: 'Andi Pratama',
      password: 'password123',
      classCode: 'CLASSA',
    });
    expect(sampleStudent.role).toBe('student');
    expect(sampleStudent.classId).toBe('seed-class-a');

    const cohortCreator = await authRepo.signUp({
      nim: '11S24002',
      displayName: 'Budi Santoso',
      password: 'password123',
      classCode: 'IF2026',
    });
    expect(cohortCreator.role).toBe('student');
    const createdClass = await db.classes.get(cohortCreator.classId!);
    expect(createdClass?.joinCode).toBe('IF2026');

    const classmate = await authRepo.signUp({
      nim: '11S24003',
      displayName: 'Citra Dewi',
      password: 'password123',
      classCode: 'if2026',
    });
    expect(classmate.role).toBe('student');
    expect(classmate.classId).toBe(cohortCreator.classId);

    await expect(
      authRepo.signUp({
        nim: '11S24004',
        displayName: 'Deni Kurnia',
        password: 'password123',
        classCode: 'BAD CODE!',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('supports cross-class Admin user directory, creation, role/class updates, password reset, activation, and 006 SQL RPCs', async () => {
    const db = createFakeDb();
    const authRepo = new HybridAuthRepository(
      db as unknown as LiteLearnDb,
      null,
    );

    const studentUser = await authRepo.signUp({
      nim: '11S24010',
      displayName: 'Student Member',
      password: 'password123',
      classCode: 'IF2027',
    });
    expect(studentUser.role).toBe('student');

    // Seed an active Admin in Class A to test cross-class management
    const adminId = 'seed-admin-1';
    await db.classes.put({
      id: 'seed-class-a',
      name: 'Class A',
      joinCode: 'CLASSA',
      createdByUserId: adminId,
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      deletedAt: null,
    });
    await db.users.put({
      id: adminId,
      nim: '00A00001',
      displayName: 'Academic Admin',
      classId: 'seed-class-a',
      role: 'admin',
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      deletedAt: null,
    });
    await db.sessions.put({
      id: 'current',
      userId: adminId,
      updatedAt: '2026-11-20T00:00:00.000Z',
    });

    const updatedProfile = await authRepo.updateProfile({
      userId: studentUser.id,
      displayName: 'Student Member Updated',
      studyProgram: 'S1 Informatika',
      bio: 'Lab assistant candidate',
      avatarColor: '#0F766E',
      avatarDataUrl: null,
    });
    expect(updatedProfile.displayName).toBe('Student Member Updated');
    expect(updatedProfile.studyProgram).toBe('S1 Informatika');
    expect(updatedProfile.role).toBe('student');

    // Admin lists users & classes across the workspace
    const allUsers = await authRepo.listAllUsers(adminId);
    expect(allUsers.map((u) => u.id)).toEqual([adminId, studentUser.id]);
    const allClasses = await authRepo.listAllClasses(adminId);
    expect(allClasses).toHaveLength(2);

    // Admin creates a lecturer directly without hijacking the active Admin session
    const createdLecturer = await authRepo.adminCreateUser({
      actorId: adminId,
      nim: '01D24001',
      displayName: 'Dr. Sari Panjaitan',
      password: 'password123',
      role: 'lecturer',
      classId: 'seed-class-a',
      studyProgram: 'Faculty of Informatics',
    });
    expect(createdLecturer.role).toBe('lecturer');
    expect((await authRepo.getCurrentUser())?.id).toBe(adminId);

    // Admin reassigns student across classes and promotes role
    const promoted = await authRepo.adminUpdateUser({
      actorId: adminId,
      targetUserId: studentUser.id,
      role: 'assistant',
      classId: 'seed-class-a',
    });
    expect(promoted.role).toBe('assistant');
    expect(promoted.classId).toBe('seed-class-a');

    // Non-admin cannot change roles or list all users
    await expect(
      authRepo.updateMemberRole(studentUser.id, adminId, 'student'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN_ROLE' });
    await expect(authRepo.listAllUsers(studentUser.id)).rejects.toMatchObject({
      code: 'FORBIDDEN_ROLE',
    });

    // Admin resets password, user signs in and changes own password
    await authRepo.adminResetPassword({
      actorId: adminId,
      targetUserId: createdLecturer.id,
      newPassword: 'resetpass99',
    });
    const signedLecturer = await authRepo.signIn({
      nim: '01D24001',
      password: 'resetpass99',
    });
    expect(signedLecturer.id).toBe(createdLecturer.id);

    await authRepo.changeOwnPassword({
      userId: createdLecturer.id,
      currentPassword: 'resetpass99',
      newPassword: 'userpass88',
    });
    await authRepo.signIn({
      nim: '01D24001',
      password: 'userpass88',
    });

    // Admin deactivates & restores another user; cannot deactivate self or last admin
    await expect(
      authRepo.adminSetUserActive({
        actorId: adminId,
        targetUserId: adminId,
        active: false,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN_ROLE' });

    await authRepo.adminSetUserActive({
      actorId: adminId,
      targetUserId: createdLecturer.id,
      active: false,
    });
    await expect(
      authRepo.signIn({ nim: '01D24001', password: 'userpass88' }),
    ).rejects.toMatchObject({ code: 'AUTH_ERROR' });

    await authRepo.adminSetUserActive({
      actorId: adminId,
      targetUserId: createdLecturer.id,
      active: true,
    });
    await authRepo.signIn({ nim: '01D24001', password: 'userpass88' });

    // Verify 006 Supabase migration SQL contains Admin RPCs
    const migration006 = fs
      .readFileSync(
        path.join(
          repoRoot,
          'supabase',
          'migrations',
          '006_admin_user_management.sql',
        ),
        'utf8',
      )
      .toLowerCase();
    expect(migration006).toContain('public.is_admin');
    expect(migration006).toContain('public.admin_list_all_users');
    expect(migration006).toContain('public.admin_list_all_classes');
    expect(migration006).toContain('public.admin_update_user_profile');
    expect(migration006).toContain('public.admin_set_user_active');
    expect(migration006).toContain('public.admin_create_class');
  });
});
