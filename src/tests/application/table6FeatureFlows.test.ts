import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
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
  GetUpcomingDeadlines,
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
  UpdateWeek,
} from '../../application/usecases';
import type { DeadlineCompletionRepository } from '../../domain/repositories';
import {
  calculateBackoffDelayMs,
  isDueForRetry,
  shouldAutoDownloadMaterial,
} from '../../domain/rules';
import type { SyncService, SyncStateSummary } from '../../domain/services';
import { createFakeRepositories } from './fakes/FakeRepositories';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../..');

describe('Table 6 built feature flows (R1-R8 and R10)', () => {
  it('R1: completes NIM sign-up with class code, sign-out, and normalized sign-in', async () => {
    // Arrange
    const repos = createFakeRepositories();
    repos.users.set('rep-setup', {
      id: 'rep-setup',
      nim: '11S22099',
      displayName: 'Setup Rep',
      classId: null,
      role: null,
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      deletedAt: null,
    });
    const createClass = new CreateClass(repos.classes);
    const createdClass = await createClass.execute({
      userId: 'rep-setup',
      name: 'Class A',
      joinCode: 'CLASSA',
    });

    const signUp = new SignUp(repos.auth);
    const getCurrentUser = new GetCurrentUser(repos.auth, repos.classes);
    const signOut = new SignOut(repos.auth);
    const signIn = new SignIn(repos.auth);

    // Act
    const signedUp = await signUp.execute({
      nim: '11s22071',
      password: 'password123',
      confirmPassword: 'password123',
      displayName: 'Dorm Student',
      classCode: 'classa',
    });
    const sessionAfterSignUp = await getCurrentUser.execute();
    await signOut.execute();
    const sessionAfterSignOut = await getCurrentUser.execute();
    const signedIn = await signIn.execute({
      nim: '  11s22071 ',
      password: 'password123',
    });

    // Assert
    expect(signedUp.nim).toBe('11S22071');
    expect(signedUp.classId).toBe(createdClass.currentClass.id);
    expect(sessionAfterSignUp?.currentClass?.joinCode).toBe('CLASSA');
    expect(sessionAfterSignOut).toBeNull();
    expect(signedIn.id).toBe(signedUp.id);
  });

  it('R2 & R3: scopes followed courses, orders weekly content, and sorts announcements newest first', async () => {
    // Arrange
    const repos = createFakeRepositories();
    const courseA = await repos.courses.create({
      classId: 'class-1',
      code: 'IF101',
      name: 'Algorithms',
      description: 'Core algorithms',
    });
    const courseB = await repos.courses.create({
      classId: 'class-1',
      code: 'IF102',
      name: 'Databases',
      description: 'Relational design',
    });

    await repos.weeks.create({
      courseId: courseA.id,
      weekNumber: 2,
      title: 'Week 2: Trees',
      summary: 'Binary trees',
    });
    const week1 = await repos.weeks.create({
      courseId: courseA.id,
      weekNumber: 1,
      title: 'Week 1: Arrays',
      summary: 'Contiguous memory',
    });
    const mat1 = await repos.materials.create({
      courseId: courseA.id,
      weekId: week1.id,
      title: 'Array Lecture',
      description: 'Slides',
      externalUrl: null,
    });
    await repos.deadlines.create({
      courseId: courseA.id,
      weekId: week1.id,
      title: 'Lab 1',
      description: 'Arrays',
      dueAt: '2026-11-28T10:00:00.000Z',
    });
    await repos.deadlines.create({
      courseId: courseB.id,
      weekId: null,
      title: 'Unfollowed DB Task',
      description: '',
      dueAt: '2026-11-27T10:00:00.000Z',
    });
    await repos.announcements.create({
      courseId: courseA.id,
      title: 'Older Post',
      body: 'Earlier',
      postedAt: '2026-11-20T08:00:00.000Z',
    });
    await repos.announcements.create({
      courseId: courseA.id,
      title: 'Latest Post',
      body: 'Updated room',
      postedAt: '2026-11-23T08:00:00.000Z',
    });

    const listCourses = new ListCourses(repos.courses);
    const followCourse = new FollowCourse(repos.courses);
    const unfollowCourse = new UnfollowCourse(repos.courses);
    const getCourseWeeks = new GetCourseWeeks(
      repos.courses,
      repos.weeks,
      repos.materials,
      repos.deadlines,
    );
    const getMaterial = new GetMaterial(
      repos.materials,
      repos.courses,
      repos.weeks,
    );
    const listAnnouncements = new ListAnnouncements(repos.announcements);
    const getUpcomingDeadlines = new GetUpcomingDeadlines(
      repos.courses,
      repos.deadlines,
    );
    const listRecentAnnouncements = new ListRecentAnnouncements(
      repos.courses,
      repos.announcements,
    );

    // Act
    await followCourse.execute({ userId: 'student-1', courseId: courseA.id });
    const catalogFollowed = await listCourses.execute({
      classId: 'class-1',
      userId: 'student-1',
    });
    const weeksPayload = await getCourseWeeks.execute({
      courseId: courseA.id,
      userId: 'student-1',
    });
    const materialPayload = await getMaterial.execute({ materialId: mat1.id });
    const courseAnnouncements = await listAnnouncements.execute({
      courseId: courseA.id,
    });
    const upcomingFollowed = await getUpcomingDeadlines.execute({
      userId: 'student-1',
    });
    const recentFollowed = await listRecentAnnouncements.execute({
      userId: 'student-1',
    });

    await unfollowCourse.execute({ userId: 'student-1', courseId: courseA.id });
    const upcomingAfterUnfollow = await getUpcomingDeadlines.execute({
      userId: 'student-1',
    });

    // Assert
    expect(catalogFollowed.find((c) => c.id === courseA.id)?.isFollowed).toBe(
      true,
    );
    expect(catalogFollowed.find((c) => c.id === courseB.id)?.isFollowed).toBe(
      false,
    );
    expect(weeksPayload.weeks.map((w) => w.weekNumber)).toEqual([1, 2]);
    expect(weeksPayload.weeks[0]?.materials.map((m) => m.id)).toEqual([mat1.id]);
    expect(materialPayload.course.id).toBe(courseA.id);
    expect(materialPayload.week.id).toBe(week1.id);
    expect(courseAnnouncements.map((a) => a.title)).toEqual([
      'Latest Post',
      'Older Post',
    ]);
    expect(upcomingFollowed.items.map((i) => i.title)).toEqual([
      'Lab 1',
    ]);
    expect(recentFollowed).toHaveLength(2);
    expect(upcomingAfterUnfollow.items).toEqual([]);
  });

  it('R4: enforces rep/management CRUD, student block, and soft-delete visibility', async () => {
    // Arrange
    const repos = createFakeRepositories();
    const rep = {
      id: 'rep-1',
      nim: '11S22002',
      displayName: 'Class Rep',
      classId: 'class-1',
      role: 'rep' as const,
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      deletedAt: null,
    };
    const lecturer = {
      ...rep,
      id: 'lec-1',
      nim: '11S19001',
      role: 'lecturer' as const,
    };
    const student = {
      ...rep,
      id: 'stu-1',
      nim: '11S22001',
      role: 'student' as const,
    };

    const createCourse = new CreateCourse(repos.courses);
    const updateCourse = new UpdateCourse(repos.courses);
    const createWeek = new CreateWeek(repos.courses, repos.weeks);
    const updateWeek = new UpdateWeek(repos.courses, repos.weeks);
    const createMaterial = new CreateMaterial(
      repos.courses,
      repos.weeks,
      repos.materials,
    );
    const updateMaterial = new UpdateMaterial(
      repos.courses,
      repos.weeks,
      repos.materials,
    );
    const createDeadline = new CreateDeadline(
      repos.courses,
      repos.weeks,
      repos.deadlines,
    );
    const updateDeadline = new UpdateDeadline(
      repos.courses,
      repos.weeks,
      repos.deadlines,
    );
    const createAnnouncement = new CreateAnnouncement(
      repos.courses,
      repos.announcements,
    );
    const updateAnnouncement = new UpdateAnnouncement(
      repos.courses,
      repos.announcements,
    );

    // Act & Assert: Student blocked
    await expect(
      createCourse.execute({
        actor: student,
        classId: 'class-1',
        code: 'IF999',
        name: 'Blocked',
        description: '',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN_ROLE' });

    // Act: Rep and lecturer create/update across all 5 entity types
    const course = await createCourse.execute({
      actor: rep,
      classId: 'class-1',
      code: 'IF201',
      name: 'Systems',
      description: 'OS',
    });
    const week = await createWeek.execute({
      actor: lecturer,
      courseId: course.id,
      weekNumber: 1,
      title: 'Week 1',
      summary: 'Intro',
    });
    const material = await createMaterial.execute({
      actor: rep,
      courseId: course.id,
      weekId: week.id,
      title: 'Notes v1',
      description: 'First',
      externalUrl: null,
    });
    const deadline = await createDeadline.execute({
      actor: rep,
      courseId: course.id,
      weekId: week.id,
      title: 'Quiz 1',
      description: '',
      dueAt: '2026-11-29T10:00:00.000Z',
    });
    const announcement = await createAnnouncement.execute({
      actor: rep,
      courseId: course.id,
      title: 'Welcome',
      body: 'Read syllabus',
    });

    const editedMaterial = await updateMaterial.execute({
      actor: rep,
      materialId: material.id,
      weekId: week.id,
      title: 'Notes v2',
      description: 'Updated',
      externalUrl: null,
    });
    expect(editedMaterial.title).toBe('Notes v2');

    // Soft-delete hides every entity from read repositories
    const deletedIso = '2026-11-24T12:00:00.000Z';
    await updateMaterial.execute({
      actor: rep,
      materialId: material.id,
      weekId: week.id,
      title: editedMaterial.title,
      description: editedMaterial.description,
      externalUrl: null,
      deletedAt: deletedIso,
    });
    await updateDeadline.execute({
      actor: rep,
      deadlineId: deadline.id,
      weekId: week.id,
      title: deadline.title,
      description: deadline.description,
      dueAt: deadline.dueAt,
      deletedAt: deletedIso,
    });
    await updateAnnouncement.execute({
      actor: rep,
      announcementId: announcement.id,
      title: announcement.title,
      body: announcement.body,
      deletedAt: deletedIso,
    });
    await updateWeek.execute({
      actor: rep,
      weekId: week.id,
      weekNumber: 1,
      title: week.title,
      summary: week.summary,
      deletedAt: deletedIso,
    });
    const listCoursesUc = new ListCourses(repos.courses);
    const getCourseWeeksUc = new GetCourseWeeks(
      repos.courses,
      repos.weeks,
      repos.materials,
      repos.deadlines,
    );
    const getUpcomingDeadlinesUc = new GetUpcomingDeadlines(
      repos.courses,
      repos.deadlines,
    );
    const listAnnouncementsUc = new ListAnnouncements(repos.announcements);

    await repos.courses.followCourse(student.id, course.id);
    expect(
      (await getCourseWeeksUc.execute({ courseId: course.id, userId: student.id }))
        .weeks,
    ).toEqual([]);
    expect(
      (await getUpcomingDeadlinesUc.execute({ userId: student.id })).items,
    ).toEqual([]);
    expect(
      await listAnnouncementsUc.execute({ courseId: course.id }),
    ).toEqual([]);

    await updateCourse.execute({
      actor: rep,
      courseId: course.id,
      code: course.code,
      name: course.name,
      description: course.description,
      deletedAt: deletedIso,
    });
    await expect(
      getCourseWeeksUc.execute({ courseId: course.id, userId: student.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(
      await listCoursesUc.execute({ classId: 'class-1', userId: student.id }),
    ).toEqual([]);
  });

  it('R5 & R10: configures installable PWA shell, icons, and >=1024px laptop sidebar navigation', () => {
    // Arrange
    const viteConfig = fs.readFileSync(
      path.join(repoRoot, 'vite.config.ts'),
      'utf8',
    );
    const appLayoutTsx = fs.readFileSync(
      path.join(repoRoot, 'src', 'presentation', 'components', 'AppLayout.tsx'),
      'utf8',
    );
    const appLayoutCss = fs.readFileSync(
      path.join(repoRoot, 'src', 'presentation', 'components', 'AppLayout.css'),
      'utf8',
    );

    // Assert R5: PWA manifest, service worker precache, and icon assets
    expect(viteConfig).toContain('VitePWA(');
    expect(viteConfig).toContain("display: 'standalone'");
    expect(viteConfig).toContain("navigateFallback: '/index.html'");
    expect(viteConfig).toContain("src: '/icons/icon-192.png'");
    expect(viteConfig).toContain("src: '/icons/icon-512.png'");
    expect(
      fs.existsSync(path.join(repoRoot, 'public', 'icons', 'icon-192.png')),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(repoRoot, 'public', 'icons', 'icon-512.png')),
    ).toBe(true);

    // Assert R10: Laptop side navigation (>=1024px) and mobile bottom nav (<1024px)
    expect(appLayoutTsx).toContain('className="figma-sidenav"');
    expect(appLayoutTsx).toContain('className="figma-bottom-nav"');
    expect(appLayoutCss).toContain('@media (min-width: 1024px)');
    expect(appLayoutCss).toContain('.app-shell--with-sidenav');
  });

  it('R6, R7, and R8: runs sync, notes/PDF/Data-Saver flow, offline search, and deadline checklist', async () => {
    // Arrange
    const repos = createFakeRepositories();
    const course = await repos.courses.create({
      classId: 'class-1',
      code: 'IF301',
      name: 'Networks',
      description: 'TCP/IP and routing',
    });
    await repos.courses.followCourse('u1', course.id);
    const week = await repos.weeks.create({
      courseId: course.id,
      weekNumber: 1,
      title: 'Week 1: Routing',
      summary: 'OSPF',
    });
    const material = await repos.materials.create({
      courseId: course.id,
      weekId: week.id,
      title: 'Routing Handout',
      description: 'Packet forwarding',
      externalUrl: null,
      file: {
        name: 'routing.pdf',
        sizeBytes: 400_000,
        mimeType: 'application/pdf',
        bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]),
      },
    });
    const deadline = await repos.deadlines.create({
      courseId: course.id,
      weekId: week.id,
      title: 'Subnetting Homework',
      description: 'Submit answers',
      dueAt: '2026-11-30T10:00:00.000Z',
    });

    // R6: RunSync + backoff rules
    const calls: string[] = [];
    const syncService: SyncService = {
      async syncNow(userId): Promise<SyncStateSummary> {
        calls.push(`sync:${userId}`);
        return {
          isSyncing: false,
          lastSyncAt: '2026-11-24T12:00:00.000Z',
          pendingCount: 0,
          hasFailedChanges: false,
          lastError: null,
          mode: 'local',
        };
      },
      async retryFailed(userId): Promise<SyncStateSummary> {
        calls.push(`retry:${userId}`);
        return {
          isSyncing: false,
          lastSyncAt: '2026-11-24T12:01:00.000Z',
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
    const runSync = new RunSync(syncService);
    await runSync.execute({ userId: 'u1' });
    await runSync.execute({ userId: 'u1', retryFailed: true });
    expect(calls).toEqual(['sync:u1', 'retry:u1']);
    expect(calculateBackoffDelayMs(1)).toBeGreaterThan(
      calculateBackoffDelayMs(0),
    );
    expect(isDueForRetry('2026-11-24T00:00:00.000Z', Date.parse('2026-11-24T12:00:00.000Z'))).toBe(true);

    // R7: Private notes, on-demand PDF download/remove, and Data Saver rule
    const saveNote = new SaveMaterialNote(repos.notes, repos.syncQueue);
    const getNote = new GetMaterialNote(repos.notes);
    await saveNote.execute({
      userId: 'u1',
      materialId: material.id,
      body: 'Remember Dijkstra shortest path.',
    });
    expect((await getNote.execute({ userId: 'u1', materialId: material.id }))?.body).toBe(
      'Remember Dijkstra shortest path.',
    );

    const downloadPdf = new DownloadMaterialFile(repos.materials);
    const getOfflinePdf = new GetOfflineMaterialFile(repos.materials);
    const removeOfflinePdf = new RemoveOfflineMaterialFile(repos.materials);
    expect((await downloadPdf.execute({ materialId: material.id })).isAvailableOffline).toBe(true);
    expect((await getOfflinePdf.execute({ materialId: material.id }))?.fileName).toBe('routing.pdf');
    expect((await removeOfflinePdf.execute({ materialId: material.id })).isAvailableOffline).toBe(false);
    expect(shouldAutoDownloadMaterial(400_000, true)).toBe(false);
    expect(shouldAutoDownloadMaterial(400_000, false)).toBe(true);

    // R8: Offline quick search & personal deadline completion checklist
    const searchUc = new SearchWorkspace(
      repos.courses,
      repos.weeks,
      repos.materials,
      repos.deadlines,
      repos.announcements,
    );
    const searchHits = await searchUc.execute({
      classId: 'class-1',
      userId: 'u1',
      query: 'subnetting',
    });
    expect(searchHits.deadlines.map((d) => d.deadline.id)).toEqual([deadline.id]);

    const doneSet = new Set<string>();
    const completionRepo: DeadlineCompletionRepository = {
      async listCompletedDeadlineIds() {
        return Array.from(doneSet);
      },
      async setDeadlineCompleted(_userId, deadlineId, completed) {
        if (completed) {
          doneSet.add(deadlineId);
        } else {
          doneSet.delete(deadlineId);
        }
        return completed;
      },
    };
    const toggleDeadline = new ToggleDeadlineCompletion(completionRepo);
    expect(await toggleDeadline.execute({ userId: 'u1', deadlineId: deadline.id })).toBe(true);
    expect(await toggleDeadline.execute({ userId: 'u1', deadlineId: deadline.id })).toBe(false);
  });
});
