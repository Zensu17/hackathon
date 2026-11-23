import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createAppContainer } from '../../app/di';
import {
  GetCourseWeeks,
  GetUpcomingDeadlines,
  ListAnnouncements,
  ListCourses,
  UpdateAnnouncement,
  UpdateCourse,
  UpdateDeadline,
  UpdateMaterial,
  UpdateWeek,
} from '../../application/usecases';
import type {
  Announcement,
  Course,
  CourseFollow,
  Deadline,
  Material,
  User,
  Week,
} from '../../domain/entities';
import type {
  AnnouncementRepository,
  CourseRepository,
  DeadlineRepository,
  MaterialRepository,
  WeekRepository,
} from '../../domain/repositories';
import { LiteLearnDb } from '../../data/local/LiteLearnDb';
import { resolveSupabaseConfigFromEnv } from '../../data/remote/supabaseClient';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../..');

describe('Phase 2 Resilience, Lazy Supabase Import & Soft-Delete CRUD', () => {
  it('loads @supabase/supabase-js dynamically and avoids static SDK value imports in supabaseClient.ts', () => {
    const clientSource = fs.readFileSync(
      path.join(repoRoot, 'src', 'data', 'remote', 'supabaseClient.ts'),
      'utf8',
    );
    expect(clientSource).not.toMatch(/import\s*\{[^}]*createClient[^}]*\}\s*from\s*['"]@supabase\/supabase-js['"]/);
    expect(clientSource).toContain("import('@supabase/supabase-js')");
    expect(resolveSupabaseConfigFromEnv('', '')).toBeNull();
    expect(
      resolveSupabaseConfigFromEnv('https://example.supabase.co', 'anon-key'),
    ).toEqual({
      url: 'https://example.supabase.co',
      anonKey: 'anon-key',
    });
  });

  it('notifies subscribers immediately when syncQueue changes without page reload', async () => {
    const db = new LiteLearnDb('litelearn_phase2_notify_test');
    let notifications = 0;
    const unsubscribe = db.subscribeSyncQueueChanges(() => {
      notifications += 1;
    });

    db.notifySyncQueueChanged();
    await Promise.resolve();
    expect(notifications).toBe(1);

    // Coalesces burst microtask notifications cleanly.
    db.notifySyncQueueChanged();
    db.notifySyncQueueChanged();
    await Promise.resolve();
    expect(notifications).toBe(2);

    unsubscribe();
    db.notifySyncQueueChanged();
    await Promise.resolve();
    expect(notifications).toBe(2);

    const container = createAppContainer({
      databaseName: 'litelearn_phase2_container_test',
      supabaseUrl: '',
      supabaseAnonKey: '',
    });
    expect(typeof container.subscribeSyncChanges).toBe('function');
  });

  it('soft-deletes courses, weeks, materials, deadlines, and announcements via Rep update usecases', async () => {
    const nowIso = '2026-11-23T08:00:00.000Z';
    const deletedIso = '2026-11-23T09:00:00.000Z';
    const rep: User = {
      id: 'rep-1',
      nim: '11S22002',
      displayName: 'Class Rep',
      classId: 'class-1',
      role: 'rep',
      createdAt: nowIso,
      updatedAt: nowIso,
      deletedAt: null,
    };

    const courses = new Map<string, Course>([
      [
        'course-1',
        {
          id: 'course-1',
          classId: 'class-1',
          code: 'IF1101',
          name: 'Discrete Math',
          description: 'Logic and proofs',
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
      ],
    ]);
    const follows: CourseFollow[] = [
      { id: 'f-1', userId: 'rep-1', courseId: 'course-1', createdAt: nowIso },
    ];
    const weeks = new Map<string, Week>([
      [
        'week-1',
        {
          id: 'week-1',
          courseId: 'course-1',
          weekNumber: 1,
          title: 'Week 1: Logic',
          summary: 'Propositions',
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
      ],
    ]);
    const materials = new Map<string, Material>([
      [
        'mat-1',
        {
          id: 'mat-1',
          courseId: 'course-1',
          weekId: 'week-1',
          title: 'Lecture 1',
          description: 'Slides',
          externalUrl: null,
          attachment: null,
          isAvailableOffline: false,
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
      ],
    ]);
    const deadlines = new Map<string, Deadline>([
      [
        'dl-1',
        {
          id: 'dl-1',
          courseId: 'course-1',
          weekId: 'week-1',
          title: 'HW 1',
          description: 'Submit PDF',
          dueAt: '2026-11-25T16:59:00.000Z',
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
      ],
    ]);
    const announcements = new Map<string, Announcement>([
      [
        'ann-1',
        {
          id: 'ann-1',
          courseId: 'course-1',
          title: 'Room moved',
          body: 'GD-512',
          postedAt: nowIso,
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
      ],
    ]);

    const courseRepo: CourseRepository = {
      async listByClassId(classId) {
        return [...courses.values()].filter(
          (c) => c.classId === classId && c.deletedAt === null,
        );
      },
      async getById(id) {
        return courses.get(id) ?? null;
      },
      async listFollowedCourseIds(userId) {
        return follows.filter((f) => f.userId === userId).map((f) => f.courseId);
      },
      async followCourse(userId, courseId) {
        const follow = { id: 'f-new', userId, courseId, createdAt: nowIso };
        follows.push(follow);
        return follow;
      },
      async unfollowCourse() {},
      async create() {
        throw new Error('unused');
      },
      async update(id, input) {
        const next: Course = {
          ...courses.get(id)!,
          ...input,
          deletedAt: input.deletedAt ?? null,
          updatedAt: deletedIso,
        };
        courses.set(id, next);
        return next;
      },
    };

    const weekRepo: WeekRepository = {
      async listByCourseId(courseId) {
        return [...weeks.values()].filter(
          (w) => w.courseId === courseId && w.deletedAt === null,
        );
      },
      async getById(id) {
        return weeks.get(id) ?? null;
      },
      async create() {
        throw new Error('unused');
      },
      async update(id, input) {
        const next: Week = {
          ...weeks.get(id)!,
          ...input,
          deletedAt: input.deletedAt ?? null,
          updatedAt: deletedIso,
        };
        weeks.set(id, next);
        return next;
      },
    };

    const materialRepo: MaterialRepository = {
      async listByCourseId(courseId) {
        return [...materials.values()].filter(
          (m) => m.courseId === courseId && m.deletedAt === null,
        );
      },
      async listByWeekId(weekId) {
        return [...materials.values()].filter(
          (m) => m.weekId === weekId && m.deletedAt === null,
        );
      },
      async getById(id) {
        return materials.get(id) ?? null;
      },
      async create() {
        throw new Error('unused');
      },
      async update(id, input) {
        const next: Material = {
          ...materials.get(id)!,
          weekId: input.weekId,
          title: input.title,
          description: input.description,
          externalUrl: input.externalUrl,
          deletedAt: input.deletedAt ?? null,
          updatedAt: deletedIso,
        };
        materials.set(id, next);
        return next;
      },
    };

    const deadlineRepo: DeadlineRepository = {
      async listByCourseIds(courseIds) {
        return [...deadlines.values()].filter(
          (d) => courseIds.includes(d.courseId) && d.deletedAt === null,
        );
      },
      async listByCourseId(courseId) {
        return [...deadlines.values()].filter(
          (d) => d.courseId === courseId && d.deletedAt === null,
        );
      },
      async getById(id) {
        return deadlines.get(id) ?? null;
      },
      async create() {
        throw new Error('unused');
      },
      async update(id, input) {
        const next: Deadline = {
          ...deadlines.get(id)!,
          ...input,
          deletedAt: input.deletedAt ?? null,
          updatedAt: deletedIso,
        };
        deadlines.set(id, next);
        return next;
      },
    };

    const announcementRepo: AnnouncementRepository = {
      async listByCourseId(courseId) {
        return [...announcements.values()].filter(
          (a) => a.courseId === courseId && a.deletedAt === null,
        );
      },
      async getById(id) {
        return announcements.get(id) ?? null;
      },
      async create() {
        throw new Error('unused');
      },
      async update(id, input) {
        const next: Announcement = {
          ...announcements.get(id)!,
          ...input,
          deletedAt: input.deletedAt ?? null,
          updatedAt: deletedIso,
        };
        announcements.set(id, next);
        return next;
      },
    };

    const updateMaterial = new UpdateMaterial(courseRepo, weekRepo, materialRepo);
    const updateDeadline = new UpdateDeadline(courseRepo, weekRepo, deadlineRepo);
    const updateAnnouncement = new UpdateAnnouncement(courseRepo, announcementRepo);
    const updateWeek = new UpdateWeek(courseRepo, weekRepo);
    const updateCourse = new UpdateCourse(courseRepo);

    const getCourseWeeks = new GetCourseWeeks(
      courseRepo,
      weekRepo,
      materialRepo,
      deadlineRepo,
    );
    const getUpcomingDeadlines = new GetUpcomingDeadlines(courseRepo, deadlineRepo);
    const listAnnouncements = new ListAnnouncements(announcementRepo);
    const listCourses = new ListCourses(courseRepo);

    await updateMaterial.execute({
      actor: rep,
      materialId: 'mat-1',
      weekId: 'week-1',
      title: 'Lecture 1',
      description: 'Slides',
      externalUrl: null,
      deletedAt: deletedIso,
    });
    await updateDeadline.execute({
      actor: rep,
      deadlineId: 'dl-1',
      weekId: 'week-1',
      title: 'HW 1',
      description: 'Submit PDF',
      dueAt: '2026-11-25T16:59:00.000Z',
      deletedAt: deletedIso,
    });
    await updateAnnouncement.execute({
      actor: rep,
      announcementId: 'ann-1',
      title: 'Room moved',
      body: 'GD-512',
      deletedAt: deletedIso,
    });
    await updateWeek.execute({
      actor: rep,
      weekId: 'week-1',
      weekNumber: 1,
      title: 'Week 1: Logic',
      summary: 'Propositions',
      deletedAt: deletedIso,
    });

    const weeksAfter = await getCourseWeeks.execute({
      courseId: 'course-1',
      userId: 'rep-1',
    });
    expect(weeksAfter.weeks).toHaveLength(0);
    expect(
      (await getUpcomingDeadlines.execute({ userId: 'rep-1' })).items,
    ).toHaveLength(0);
    expect(await listAnnouncements.execute({ courseId: 'course-1' })).toHaveLength(
      0,
    );

    await updateCourse.execute({
      actor: rep,
      courseId: 'course-1',
      code: 'IF1101',
      name: 'Discrete Math',
      description: 'Logic and proofs',
      deletedAt: deletedIso,
    });
    expect(
      await listCourses.execute({ classId: 'class-1', userId: 'rep-1' }),
    ).toHaveLength(0);
  });
});
