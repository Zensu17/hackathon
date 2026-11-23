import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { Note, SyncQueueItem } from '../../domain/entities';
import type { LiteLearnDb } from '../../data/local/LiteLearnDb';
import type { SupabaseRemoteDataSource } from '../../data/remote/SupabaseRemoteDataSource';
import type { DexieSyncQueueRepository } from '../../data/repositories/DexieSyncQueueRepository';
import { HybridCourseRepository } from '../../data/repositories/HybridCourseRepository';
import { HybridMaterialRepository } from '../../data/repositories/HybridMaterialRepository';
import {
  LAST_SYNC_META_KEY,
  LiteLearnSyncService,
} from '../../data/services/LiteLearnSyncService';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../..');

interface InMemoryTable<T extends Record<string, unknown>> {
  rows: Map<string, T>;
  keyField: string;
  get: (key: string) => Promise<T | undefined>;
  put: (row: T) => Promise<string>;
  bulkPut: (rows: T[]) => Promise<void>;
  delete: (key: string) => Promise<void>;
  bulkDelete: (keys: string[]) => Promise<void>;
  toArray: () => Promise<T[]>;
  clear: () => Promise<void>;
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
): InMemoryTable<T> {
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
    keyField,
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
    async clear() {
      rows.clear();
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
  const db = {
    users: createMemoryTable<Record<string, unknown>>('id'),
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
    async transaction(_mode: string, _tables: unknown, fn: () => Promise<unknown>) {
      return fn();
    },
  };
  return db;
}

describe('Phase 1 Backend Hardening: Sync, Offline PDFs, Notes Pull, Delta Pull & Security', () => {
  it('enforces RLS notes class scope, safe NIM fallback, and Vercel security headers', () => {
    const migration003 = fs
      .readFileSync(
        path.join(repoRoot, 'supabase', 'migrations', '003_sync_and_rls_hardening.sql'),
        'utf8',
      )
      .toLowerCase();
    expect(migration003).toContain('public.material_class_id(material_id)');
    expect(migration003).toContain('public.current_user_class_id()');
    expect(migration003).not.toContain("'11s22001'");
    expect(migration003).toContain('class representatives cannot switch classes');

    const vercelConfig = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'vercel.json'), 'utf8'),
    ) as { headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }> };
    const globalHeaders = vercelConfig.headers.find((h) => h.source === '/(.*)')?.headers ?? [];
    const keys = globalHeaders.map((h) => h.key);
    expect(keys).toContain('X-Content-Type-Options');
    expect(keys).toContain('X-Frame-Options');
    expect(keys).toContain('Referrer-Policy');
    expect(keys).toContain('Permissions-Policy');
  });

  it('queues offline PDF uploads with courseId and uploads cached blobs on remote sync', async () => {
    const db = createFakeDb();
    await db.users.put({
      id: 'user-1',
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
      code: 'CRS-101',
      name: 'Algorithms',
      description: '',
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      deletedAt: null,
    });

    const uploadMaterialPdf = vi.fn(async () => ({
      storagePath: 'class-1/course-1/mat-1/slides.pdf',
      remoteUrl: 'https://signed.example/slides.pdf',
    }));
    const upsertMaterialPayload = vi.fn(async () => undefined);
    const deleteMaterialPdf = vi.fn(async () => undefined);

    const fakeRemote = {
      createMaterial: vi.fn(async () => {
        throw new Error('Failed to fetch');
      }),
      uploadMaterialPdf,
      upsertMaterialPayload,
      deleteMaterialPdf,
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
      title: 'Offline Slides',
      description: 'Uploaded while dorm Wi-Fi was down',
      externalUrl: null,
      file: {
        name: 'slides.pdf',
        sizeBytes: 4,
        mimeType: 'application/pdf',
        bytes: new Uint8Array([37, 80, 68, 70]),
      },
    });

    expect(created.isAvailableOffline).toBe(true);
    const queued = await db.syncQueue.toArray();
    expect(queued).toHaveLength(1);
    const parsedPayload = JSON.parse(String(queued[0]?.payloadJson)) as Record<string, unknown>;
    expect(parsedPayload.courseId).toBe('course-1');
    expect(parsedPayload.hasPendingBlob).toBe(true);

    const syncQueueRepo = {
      listPending: async () =>
        (await db.syncQueue.toArray()) as unknown as SyncQueueItem[],
      remove: async (id: string) => db.syncQueue.delete(id),
      markFailed: vi.fn(),
      clearFailureState: vi.fn(),
    } as unknown as DexieSyncQueueRepository;

    const syncService = new LiteLearnSyncService(
      db as unknown as LiteLearnDb,
      syncQueueRepo,
      materialRepo,
      fakeRemote,
    );

    await syncService.syncNow('user-1');

    expect(uploadMaterialPdf).toHaveBeenCalledTimes(1);
    expect(upsertMaterialPayload).toHaveBeenCalledTimes(1);
    const syncedArg = (upsertMaterialPayload.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(syncedArg.courseId).toBe('course-1');
    expect(syncedArg.attachmentStoragePath).toBe('class-1/course-1/mat-1/slides.pdf');
    expect(await db.syncQueue.toArray()).toHaveLength(0);
  });

  it('queues offline course_follow changes, replays them, pulls notes safely, and passes delta sinceIso', async () => {
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
      key: LAST_SYNC_META_KEY,
      value: '2026-11-22T10:00:00.000Z',
    });

    // Local note on mat-dirty is newer and must NOT be overwritten by older remote note.
    await db.notes.put({
      id: 'note-local-1',
      userId: 'user-1',
      materialId: 'mat-dirty',
      body: 'Newer local dorm study note',
      createdAt: '2026-11-22T09:00:00.000Z',
      updatedAt: '2026-11-23T08:00:00.000Z',
      deletedAt: null,
    });

    const insertCourseFollow = vi
      .fn()
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValue({
        id: 'cf-1',
        userId: 'user-1',
        courseId: 'course-2',
        createdAt: '2026-11-23T09:00:00.000Z',
      });

    const fetchCoursesByClassId = vi.fn(async () => []);
    const fetchFollowedCoursesContent = vi.fn(async () => ({
      weeks: [],
      materials: [],
      deadlines: [],
      announcements: [],
    }));
    const fetchUserNotes = vi.fn(
      async (): Promise<Note[]> => [
        {
          id: 'note-remote-old',
          userId: 'user-1',
          materialId: 'mat-dirty',
          body: 'Stale remote copy',
          createdAt: '2026-11-22T09:00:00.000Z',
          updatedAt: '2026-11-22T12:00:00.000Z',
          deletedAt: null,
        },
        {
          id: 'note-remote-new',
          userId: 'user-1',
          materialId: 'mat-clean',
          body: 'Synced from laptop device',
          createdAt: '2026-11-23T07:00:00.000Z',
          updatedAt: '2026-11-23T07:30:00.000Z',
          deletedAt: null,
        },
      ],
    );

    const fakeRemote = {
      insertCourseFollow,
      deleteCourseFollow: vi.fn(async () => undefined),
      fetchCoursesByClassId,
      fetchFollowedCoursesContent,
      fetchUserNotes,
    } as unknown as SupabaseRemoteDataSource;

    const courseRepo = new HybridCourseRepository(
      db as unknown as LiteLearnDb,
      fakeRemote,
    );
    const materialRepo = new HybridMaterialRepository(
      db as unknown as LiteLearnDb,
      fakeRemote,
    );

    // Offline follow succeeds locally and queues sync.
    await courseRepo.followCourse('user-1', 'course-2');
    expect(await courseRepo.listFollowedCourseIds('user-1')).toEqual(['course-2']);
    expect(await db.syncQueue.toArray()).toHaveLength(1);

    const syncQueueRepo = {
      listPending: async () =>
        (await db.syncQueue.toArray()) as unknown as SyncQueueItem[],
      remove: async (id: string) => db.syncQueue.delete(id),
      markFailed: vi.fn(),
      clearFailureState: vi.fn(),
    } as unknown as DexieSyncQueueRepository;

    const syncService = new LiteLearnSyncService(
      db as unknown as LiteLearnDb,
      syncQueueRepo,
      materialRepo,
      fakeRemote,
    );

    await syncService.syncNow('user-1');

    // course_follow replayed + newly followed course fetched in full (sinceIso = null)
    expect(insertCourseFollow).toHaveBeenCalledTimes(2);
    expect(fetchCoursesByClassId).toHaveBeenCalledWith(
      'class-1',
      '2026-11-22T10:00:00.000Z',
    );
    expect(fetchFollowedCoursesContent).toHaveBeenCalledWith(['course-2'], null);
    expect(fetchUserNotes).toHaveBeenCalledWith(
      'user-1',
      '2026-11-22T10:00:00.000Z',
    );

    // Conflict-safe note merge verified: newer local kept, new remote pulled!
    const localDirty = await db.notes.get('note-local-1');
    const pulledClean = await db.notes.get('note-remote-new');
    expect(localDirty?.body).toBe('Newer local dorm study note');
    expect(pulledClean?.body).toBe('Synced from laptop device');
  });

  it('syncs offline removeAttachment with courseId and mints fresh signed URLs on download', async () => {
    const db = createFakeDb();
    await db.users.put({
      id: 'user-1',
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
      code: 'CRS-101',
      name: 'Algorithms',
      description: '',
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      deletedAt: null,
    });
    await db.materials.put({
      id: 'mat-existing',
      courseId: 'course-1',
      weekId: 'week-1',
      title: 'Old Lecture PDF',
      description: 'Initial slides',
      externalUrl: null,
      attachmentName: 'old.pdf',
      attachmentSizeBytes: 4,
      attachmentMimeType: 'application/pdf',
      attachmentStoragePath: 'class-1/course-1/mat-existing/old.pdf',
      attachmentRemoteUrl: 'https://expired.example/old.pdf',
      isAvailableOffline: false,
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      deletedAt: null,
    });

    const getSignedMaterialUrl = vi.fn(async () => 'https://fresh-signed.example/old.pdf');
    const deleteMaterialPdf = vi.fn(async () => undefined);
    const upsertMaterialPayload = vi.fn(async () => undefined);

    const fakeRemote = {
      getSignedMaterialUrl,
      updateMaterial: vi.fn(async () => {
        throw new Error('Failed to fetch');
      }),
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

    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(async () => ({
      ok: true,
      headers: {
        get: () => 'application/pdf',
      },
      arrayBuffer: async () => new Uint8Array([37, 80, 68, 70]).buffer,
    })) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    try {
      const materialRepo = new HybridMaterialRepository(
        db as unknown as LiteLearnDb,
        fakeRemote,
      );

      // 1. Fresh signed URL minting avoids reusing stale cached attachmentRemoteUrl
      const existingMaterial = await materialRepo.getById('mat-existing');
      expect(existingMaterial).not.toBeNull();
      if (!existingMaterial) {
        throw new Error('Expected test material to exist');
      }
      await materialRepo.downloadRemoteFile(existingMaterial);
      expect(getSignedMaterialUrl).toHaveBeenCalledWith('class-1/course-1/mat-existing/old.pdf');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fresh-signed.example/old.pdf',
        expect.anything(),
      );

      // 2. Offline removeAttachment preserves courseId + previousStoragePath and deletes remote PDF on sync
      await materialRepo.update('mat-existing', {
        weekId: 'week-1',
        title: 'Lecture Notes Only',
        description: 'Initial slides',
        externalUrl: null,
        removeAttachment: true,
      });

      const syncQueueRepo = {
        listPending: async () =>
          (await db.syncQueue.toArray()) as unknown as SyncQueueItem[],
        remove: async (id: string) => db.syncQueue.delete(id),
        markFailed: vi.fn(),
        clearFailureState: vi.fn(),
      } as unknown as DexieSyncQueueRepository;

      const syncService = new LiteLearnSyncService(
        db as unknown as LiteLearnDb,
        syncQueueRepo,
        materialRepo,
        fakeRemote,
      );

      await syncService.syncNow('user-1');

      expect(deleteMaterialPdf).toHaveBeenCalledWith('class-1/course-1/mat-existing/old.pdf');
      expect(upsertMaterialPayload).toHaveBeenCalledTimes(1);
      const syncedArg = (upsertMaterialPayload.mock.calls[0] as unknown as [Record<string, unknown>])[0];
      expect(syncedArg.courseId).toBe('course-1');
      expect(syncedArg.removeAttachment).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
