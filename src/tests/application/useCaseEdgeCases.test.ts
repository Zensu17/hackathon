import { describe, expect, it, vi } from 'vitest';
import {
  DownloadMaterialFile,
  GetMaterialNote,
  GetOfflineStudyOverview,
  ListRecentAnnouncements,
  SaveMaterialNote,
  SearchWorkspace,
  SignIn,
  SignUp,
  ToggleDeadlineCompletion,
} from '../../application/usecases';
import type {
  AnnouncementRepository,
  DeadlineCompletionRepository,
  MaterialRepository,
  SyncQueueRepository,
} from '../../domain/repositories';
import { hasPdfMagicHeader } from '../../domain/rules';
import { createFakeRepositories } from './fakes/FakeRepositories';

describe('Application use-case edge cases and PDF magic header rule', () => {
  it('validates PDF magic headers accurately in hasPdfMagicHeader', () => {
    // Arrange / Act / Assert
    expect(hasPdfMagicHeader(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe(
      true,
    );
    expect(
      hasPdfMagicHeader(new TextEncoder().encode('%PDF-1.7\n...')),
    ).toBe(true);

    expect(hasPdfMagicHeader(new Uint8Array([]))).toBe(false);
    expect(hasPdfMagicHeader(new TextEncoder().encode('<html></html>'))).toBe(
      false,
    );
    expect(hasPdfMagicHeader(new TextEncoder().encode('<svg></svg>'))).toBe(
      false,
    );
    expect(hasPdfMagicHeader(new TextEncoder().encode('%PDF<script>'))).toBe(
      false,
    );
  });

  it('rejects invalid inputs, missing attachments, and non-PDF downloads in DownloadMaterialFile', async () => {
    // Arrange
    const repos = createFakeRepositories();
    const course = await repos.courses.create({
      classId: 'class-1',
      code: 'IF101',
      name: 'Algorithms',
      description: '',
    });
    const week = await repos.weeks.create({
      courseId: course.id,
      weekNumber: 1,
      title: 'Week 1',
      summary: '',
    });
    const noPdfMaterial = await repos.materials.create({
      courseId: course.id,
      weekId: week.id,
      title: 'Link Only',
      description: '',
      externalUrl: 'https://example.org',
    });
    const pdfMaterial = await repos.materials.create({
      courseId: course.id,
      weekId: week.id,
      title: 'Slides',
      description: '',
      externalUrl: null,
      file: {
        name: 'slides.pdf',
        sizeBytes: 120,
        mimeType: 'application/pdf',
        bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
      },
    });

    const downloadUc = new DownloadMaterialFile(repos.materials);

    // Act & Assert: Blank ID, missing material, missing attachment
    await expect(downloadUc.execute({ materialId: '   ' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    await expect(
      downloadUc.execute({ materialId: 'does-not-exist' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      downloadUc.execute({ materialId: noPdfMaterial.id }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    // Arrange: Spoofed HTML response bytes
    const saveOfflineFile = vi.fn();
    const maliciousRepo: MaterialRepository = {
      listByCourseId: repos.materials.listByCourseId.bind(repos.materials),
      listByWeekId: repos.materials.listByWeekId.bind(repos.materials),
      getById: repos.materials.getById.bind(repos.materials),
      create: repos.materials.create.bind(repos.materials),
      update: repos.materials.update.bind(repos.materials),
      downloadRemoteFile: async () => ({
        bytes: new TextEncoder().encode('<!DOCTYPE html><script>x</script>'),
        mimeType: 'text/html',
      }),
      saveOfflineFile,
    };
    const guardedUc = new DownloadMaterialFile(maliciousRepo);

    // Act & Assert: Rejects non-PDF bytes before saving
    await expect(
      guardedUc.execute({ materialId: pdfMaterial.id }),
    ).rejects.toMatchObject({ code: 'INVALID_FILE_TYPE' });
    expect(saveOfflineFile).not.toHaveBeenCalled();
  });

  it('handles empty queries, unfollowed-only classes, and filename/week matches in SearchWorkspace', async () => {
    // Arrange
    const repos = createFakeRepositories();
    const course = await repos.courses.create({
      classId: 'class-1',
      code: 'IF201',
      name: 'Operating Systems',
      description: 'Kernels and scheduling',
    });
    const week = await repos.weeks.create({
      courseId: course.id,
      weekNumber: 2,
      title: 'Concurrency and Deadlocks',
      summary: '',
    });
    await repos.materials.create({
      courseId: course.id,
      weekId: week.id,
      title: 'Lecture Notes',
      description: 'Overview',
      externalUrl: null,
      file: {
        name: 'mutex-lab-guide.pdf',
        sizeBytes: 1000,
        mimeType: 'application/pdf',
        bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
      },
    });

    const searchUc = new SearchWorkspace(
      repos.courses,
      repos.weeks,
      repos.materials,
      repos.deadlines,
      repos.announcements,
    );

    // Act & Assert: Validation & blank query short-circuit
    await expect(
      searchUc.execute({ classId: ' ', userId: 'u1', query: 'os' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    const blankResult = await searchUc.execute({
      classId: 'class-1',
      userId: 'u1',
      query: '   ',
    });
    expect(blankResult.totalCount).toBe(0);

    // Unfollowed user matches course catalog only, not inner materials
    const unfollowedResult = await searchUc.execute({
      classId: 'class-1',
      userId: 'u1',
      query: 'operating',
    });
    expect(unfollowedResult.courses).toHaveLength(1);
    expect(unfollowedResult.materials).toHaveLength(0);

    // Followed user matches material by attachment filename and week title
    await repos.courses.followCourse('u1', course.id);
    const byFilename = await searchUc.execute({
      classId: 'class-1',
      userId: 'u1',
      query: 'mutex-lab',
    });
    expect(byFilename.materials).toHaveLength(1);
    const byWeekTitle = await searchUc.execute({
      classId: 'class-1',
      userId: 'u1',
      query: 'deadlocks',
    });
    expect(byWeekTitle.materials).toHaveLength(1);
  });

  it('computes empty overview and separates overdue vs upcoming deadlines in GetOfflineStudyOverview', async () => {
    // Arrange
    const repos = createFakeRepositories();
    const overviewUc = new GetOfflineStudyOverview(
      repos.courses,
      repos.weeks,
      repos.materials,
      repos.deadlines,
    );

    await expect(overviewUc.execute({ userId: '  ' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });

    const empty = await overviewUc.execute({ userId: 'u1' });
    expect(empty.followedCourseCount).toBe(0);
    expect(empty.courses).toEqual([]);

    const course = await repos.courses.create({
      classId: 'class-1',
      code: 'IF301',
      name: 'Networks',
      description: '',
    });
    await repos.courses.followCourse('u1', course.id);
    await repos.deadlines.create({
      courseId: course.id,
      weekId: null,
      title: 'Past Quiz',
      description: '',
      dueAt: '2026-11-20T08:00:00.000Z',
    });
    await repos.deadlines.create({
      courseId: course.id,
      weekId: null,
      title: 'Upcoming Lab',
      description: '',
      dueAt: '2026-11-28T08:00:00.000Z',
    });

    // Act
    const summary = await overviewUc.execute({
      userId: 'u1',
      now: new Date('2026-11-24T00:00:00.000Z'),
    });

    // Assert
    expect(summary.followedCourseCount).toBe(1);
    expect(summary.courses[0]?.upcomingDeadlineCount).toBe(1);
  });

  it('respects custom limits and falls back to listByCourseId in ListRecentAnnouncements', async () => {
    // Arrange
    const repos = createFakeRepositories();
    const course = await repos.courses.create({
      classId: 'class-1',
      code: 'IF101',
      name: 'Algorithms',
      description: '',
    });
    await repos.courses.followCourse('u1', course.id);
    await repos.announcements.create({
      courseId: course.id,
      title: 'First',
      body: 'Body 1',
      postedAt: '2026-11-20T08:00:00.000Z',
    });
    await repos.announcements.create({
      courseId: course.id,
      title: 'Second',
      body: 'Body 2',
      postedAt: '2026-11-22T08:00:00.000Z',
    });

    // Repository without optional listByCourseIds method to exercise fallback branch
    const fallbackRepo: AnnouncementRepository = {
      listByCourseId: repos.announcements.listByCourseId.bind(repos.announcements),
      getById: repos.announcements.getById.bind(repos.announcements),
      create: repos.announcements.create.bind(repos.announcements),
      update: repos.announcements.update.bind(repos.announcements),
    };
    const uc = new ListRecentAnnouncements(repos.courses, fallbackRepo);

    // Act
    const limited = await uc.execute({ userId: 'u1', limit: 1 });

    // Assert
    expect(limited).toHaveLength(1);
    expect(limited[0]?.announcement.title).toBe('Second');
  });

  it('validates blank note IDs and tags queued note sync items with userId in SaveMaterialNote', async () => {
    // Arrange
    const repos = createFakeRepositories();
    const enqueueSpy = vi.fn(async (input) => ({
      id: 'q-1',
      ...input,
      attempts: 0,
      lastError: null,
      nextRetryAt: null,
      createdAt: '2026-11-24T08:00:00.000Z',
    }));
    const spyQueueRepo: SyncQueueRepository = {
      listPending: vi.fn(async () => []),
      countPending: vi.fn(async () => 0),
      enqueue: enqueueSpy,
      markFailed: vi.fn(async () => undefined),
      clearFailureState: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };

    const saveUc = new SaveMaterialNote(repos.notes, spyQueueRepo);
    const getUc = new GetMaterialNote(repos.notes);

    // Act & Assert: Blank IDs rejected
    await expect(
      saveUc.execute({ userId: ' ', materialId: 'mat-1', body: 'hi' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(
      getUc.execute({ userId: 'u1', materialId: '' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    // Act & Assert: Valid save tags queue item with userId (CR-05)
    await saveUc.execute({
      userId: ' u1 ',
      materialId: ' mat-1 ',
      body: 'Key insight',
    });
    expect(enqueueSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        entityType: 'note',
        operation: 'upsert',
      }),
    );
  });

  it('validates IDs and flips completion state cleanly in ToggleDeadlineCompletion', async () => {
    // Arrange
    const completed = new Set<string>();
    const repo: DeadlineCompletionRepository = {
      async listCompletedDeadlineIds() {
        return Array.from(completed);
      },
      async setDeadlineCompleted(_userId, deadlineId, isDone) {
        if (isDone) {
          completed.add(deadlineId);
        } else {
          completed.delete(deadlineId);
        }
        return isDone;
      },
    };
    const uc = new ToggleDeadlineCompletion(repo);

    // Act & Assert
    await expect(
      uc.execute({ userId: '', deadlineId: 'dl-1' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    expect(await uc.execute({ userId: 'u1', deadlineId: 'dl-1' })).toBe(true);
    expect(await uc.execute({ userId: 'u1', deadlineId: 'dl-1' })).toBe(false);
    expect(
      await uc.execute({ userId: 'u1', deadlineId: 'dl-1', completed: true }),
    ).toBe(true);
  });

  it('validates missing SignUp fields and invalid SignIn NIM inputs cleanly', async () => {
    // Arrange
    const repos = createFakeRepositories();
    const signIn = new SignIn(repos.auth);
    const signUp = new SignUp(repos.auth);

    // Act & Assert
    await expect(
      signIn.execute({ nim: 'INVALID', password: 'password123' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(
      signUp.execute({
        nim: '11S22001',
        password: 'password123',
        displayName: '   ',
        classCode: 'CLASSA',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(
      signUp.execute({
        nim: '11S22001',
        password: 'password123',
        displayName: 'Student',
        classCode: '   ',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
