import { describe, expect, it } from 'vitest';
import {
  DownloadMaterialFile,
  GetMaterialNote,
  GetOfflineMaterialFile,
  GetOfflineStudyOverview,
  ListRecentAnnouncements,
  RemoveOfflineMaterialFile,
  RunSync,
  SaveMaterialNote,
  SearchWorkspace,
} from '../../application/usecases';
import type { SyncService, SyncStateSummary } from '../../domain/services';
import { createFakeRepositories } from './fakes/FakeRepositories';

describe('Offline PDF downloads, private notes, global search, announcements, and sync use cases', () => {
  it('downloads, persists, retrieves, and removes offline PDF blobs accurately', async () => {
    const repos = createFakeRepositories();
    const course = await repos.courses.create({
      classId: 'class-1',
      code: 'CRS-101',
      name: 'Course A',
      description: 'Sample course',
    });
    const week = await repos.weeks.create({
      courseId: course.id,
      weekNumber: 1,
      title: 'Week 1',
      summary: 'Intro',
    });
    const material = await repos.materials.create({
      courseId: course.id,
      weekId: week.id,
      title: 'Lecture 1 Handout',
      description: 'Core notes',
      externalUrl: null,
      file: {
        name: 'week1.pdf',
        sizeBytes: 120_000,
        mimeType: 'application/pdf',
        bytes: new Uint8Array([37, 80, 68, 70]),
      },
    });

    const downloadUc = new DownloadMaterialFile(repos.materials);
    const getOfflineUc = new GetOfflineMaterialFile(repos.materials);
    const removeOfflineUc = new RemoveOfflineMaterialFile(repos.materials);

    expect(material.isAvailableOffline).toBe(false);
    const updated = await downloadUc.execute({ materialId: material.id });
    expect(updated.isAvailableOffline).toBe(true);

    const file = await getOfflineUc.execute({ materialId: material.id });
    expect(file).not.toBeNull();
    expect(file?.fileName).toBe('week1.pdf');
    expect(file?.bytes.byteLength).toBeGreaterThan(0);

    const cleared = await removeOfflineUc.execute({ materialId: material.id });
    expect(cleared.isAvailableOffline).toBe(false);
    expect(await getOfflineUc.execute({ materialId: material.id })).toBeNull();
  });

  it('saves private study notes locally and queues a sync operation', async () => {
    const repos = createFakeRepositories();
    const saveNote = new SaveMaterialNote(repos.notes, repos.syncQueue);
    const getNote = new GetMaterialNote(repos.notes);

    const saved = await saveNote.execute({
      userId: 'user-1',
      materialId: 'material-1',
      body: 'Review Big-O notation before Friday quiz.',
    });

    expect(saved.body).toBe('Review Big-O notation before Friday quiz.');
    expect(await repos.syncQueue.countPending()).toBe(1);

    const loaded = await getNote.execute({
      userId: 'user-1',
      materialId: 'material-1',
    });
    expect(loaded?.body).toBe('Review Big-O notation before Friday quiz.');
  });

  it('lists recent announcements strictly for followed courses newest first and supports offline workspace search', async () => {
    const repos = createFakeRepositories();
    const courseA = await repos.courses.create({
      classId: 'class-1',
      code: 'CRS-101',
      name: 'Algorithms',
      description: 'Graph and tree structures',
    });
    const courseB = await repos.courses.create({
      classId: 'class-1',
      code: 'CRS-102',
      name: 'Databases',
      description: 'SQL normalization',
    });
    await repos.courses.followCourse('user-1', courseA.id);

    const weekA = await repos.weeks.create({
      courseId: courseA.id,
      weekNumber: 1,
      title: 'Week 1 Trees',
      summary: 'Binary search trees',
    });
    await repos.materials.create({
      courseId: courseA.id,
      weekId: weekA.id,
      title: 'Binary Tree Slides',
      description: 'Traversal algorithms',
      externalUrl: null,
      file: {
        name: 'trees.pdf',
        sizeBytes: 300_000,
        mimeType: 'application/pdf',
        bytes: new Uint8Array([37, 80, 68, 70]),
      },
    });
    await repos.deadlines.create({
      courseId: courseA.id,
      weekId: weekA.id,
      title: 'Tree Lab Assignment',
      description: 'Submit tree traversal code',
      dueAt: '2026-11-28T10:00:00.000Z',
    });
    await repos.announcements.create({
      courseId: courseA.id,
      title: 'Older update',
      body: 'Room moved',
      postedAt: '2026-11-20T08:00:00.000Z',
    });
    await repos.announcements.create({
      courseId: courseA.id,
      title: 'Newest tree notice',
      body: 'Bring laptop to lab',
      postedAt: '2026-11-22T08:00:00.000Z',
    });
    await repos.announcements.create({
      courseId: courseB.id,
      title: 'Unfollowed course notice',
      body: 'Should not appear',
      postedAt: '2026-11-23T08:00:00.000Z',
    });

    const recentUc = new ListRecentAnnouncements(
      repos.courses,
      repos.announcements,
    );
    const recent = await recentUc.execute({ userId: 'user-1', limit: 5 });
    expect(recent).toHaveLength(2);
    expect(recent[0]?.announcement.title).toBe('Newest tree notice');

    const searchUc = new SearchWorkspace(
      repos.courses,
      repos.weeks,
      repos.materials,
      repos.deadlines,
      repos.announcements,
    );
    const hits = await searchUc.execute({
      classId: 'class-1',
      userId: 'user-1',
      query: 'tree',
    });
    expect(hits.materials).toHaveLength(1);
    expect(hits.deadlines).toHaveLength(1);
    expect(hits.announcements).toHaveLength(1);
    expect(hits.totalCount).toBeGreaterThanOrEqual(3);

    const overviewUc = new GetOfflineStudyOverview(
      repos.courses,
      repos.weeks,
      repos.materials,
      repos.deadlines,
    );
    const overview = await overviewUc.execute({ userId: 'user-1' });
    expect(overview.followedCourseCount).toBe(1);
    expect(overview.totalPdfMaterials).toBe(1);
    expect(overview.downloadedPdfCount).toBe(0);
  });

  it('delegates syncNow and retryFailed cleanly through RunSync', async () => {
    let calls: string[] = [];
    const fakeSync: SyncService = {
      async syncNow(userId: string): Promise<SyncStateSummary> {
        calls.push(`sync:${userId}`);
        return {
          isSyncing: false,
          lastSyncAt: '2026-11-23T09:00:00.000Z',
          pendingCount: 0,
          hasFailedChanges: false,
          lastError: null,
          mode: 'local',
        };
      },
      async retryFailed(userId: string): Promise<SyncStateSummary> {
        calls.push(`retry:${userId}`);
        return {
          isSyncing: false,
          lastSyncAt: '2026-11-23T09:05:00.000Z',
          pendingCount: 0,
          hasFailedChanges: false,
          lastError: null,
          mode: 'local',
        };
      },
      async getSyncState(): Promise<SyncStateSummary> {
        return {
          isSyncing: false,
          lastSyncAt: null,
          pendingCount: 0,
          hasFailedChanges: false,
          lastError: null,
          mode: 'local',
        };
      },
    };

    const runSync = new RunSync(fakeSync);
    const first = await runSync.execute({ userId: 'user-1' });
    expect(first.pendingCount).toBe(0);
    await runSync.execute({ userId: 'user-1', retryFailed: true });
    expect(calls).toEqual(['sync:user-1', 'retry:user-1']);
  });
});
