import { describe, expect, it } from 'vitest';
import {
  GetUpcomingDeadlines,
  ListAnnouncements,
} from '../../application/usecases';
import { createFakeRepositories } from './fakes/FakeRepositories';

describe('Deadlines and announcements use cases', () => {
  it('returns empty items without querying deadlines when user follows zero courses', async () => {
    const repos = createFakeRepositories();
    const getUpcomingDeadlines = new GetUpcomingDeadlines(
      repos.courses,
      repos.deadlines,
      () => '2026-11-05T12:00:00.000Z',
    );

    const course = await repos.courses.create({
      classId: 'class-1',
      code: 'CRS-101',
      name: 'Course A',
      description: 'Unfollowed course',
    });
    await repos.deadlines.create({
      courseId: course.id,
      weekId: null,
      title: 'Unfollowed Task',
      description: 'Should not load',
      dueAt: '2026-11-06T00:00:00.000Z',
    });

    const result = await getUpcomingDeadlines.execute({ userId: 'user-1' });
    expect(result).toEqual({
      followedCourseCount: 0,
      items: [],
    });
    expect(repos.deadlines.listByCourseIdsCalls).toBe(0);
  });

  it('returns sorted deadlines strictly for followed courses with urgency flags and excludes soft-deleted rows', async () => {
    const repos = createFakeRepositories();
    const fixedNow = '2026-11-05T12:00:00.000Z';
    const getUpcomingDeadlines = new GetUpcomingDeadlines(
      repos.courses,
      repos.deadlines,
      () => fixedNow,
    );

    const courseA = await repos.courses.create({
      classId: 'class-1',
      code: 'CRS-101',
      name: 'Course A',
      description: 'Followed',
    });
    const courseB = await repos.courses.create({
      classId: 'class-1',
      code: 'CRS-102',
      name: 'Course B',
      description: 'Unfollowed',
    });
    await repos.courses.followCourse('user-1', courseA.id);

    await repos.deadlines.create({
      courseId: courseA.id,
      weekId: null,
      title: 'Later Task',
      description: 'Next week',
      dueAt: '2026-11-10T09:00:00.000Z',
    });
    await repos.deadlines.create({
      courseId: courseA.id,
      weekId: null,
      title: 'Overdue Task',
      description: 'Missed window',
      dueAt: '2026-11-05T08:00:00.000Z',
    });
    await repos.deadlines.create({
      courseId: courseA.id,
      weekId: null,
      title: 'Due Soon Task',
      description: 'Within 24h',
      dueAt: '2026-11-06T02:00:00.000Z',
    });
    const deleted = await repos.deadlines.create({
      courseId: courseA.id,
      weekId: null,
      title: 'Deleted Task',
      description: 'Removed',
      dueAt: '2026-11-05T15:00:00.000Z',
    });
    await repos.deadlines.update(deleted.id, {
      weekId: null,
      title: deleted.title,
      description: deleted.description,
      dueAt: deleted.dueAt,
      deletedAt: '2026-11-05T10:00:00.000Z',
    });

    await repos.deadlines.create({
      courseId: courseB.id,
      weekId: null,
      title: 'Course B Task',
      description: 'Ignored',
      dueAt: '2026-11-05T13:00:00.000Z',
    });

    const result = await getUpcomingDeadlines.execute({ userId: 'user-1' });
    expect(result.followedCourseCount).toBe(1);
    expect(result.items.map((item) => item.title)).toEqual([
      'Overdue Task',
      'Due Soon Task',
      'Later Task',
    ]);
    expect(result.items[0]).toMatchObject({
      courseCode: 'CRS-101',
      courseName: 'Course A',
      isOverdue: true,
      isDueSoon: false,
    });
    expect(result.items[1]).toMatchObject({
      isOverdue: false,
      isDueSoon: true,
    });
    expect(result.items[2]).toMatchObject({
      isOverdue: false,
      isDueSoon: false,
    });
  });

  it('sorts ListAnnouncements newest first by postedAt and excludes soft-deleted items', async () => {
    const repos = createFakeRepositories();
    const listAnnouncements = new ListAnnouncements(repos.announcements);

    await repos.announcements.create({
      courseId: 'course-1',
      title: 'Older Notice',
      body: 'Posted yesterday',
      postedAt: '2026-11-03T09:00:00.000Z',
    });
    await repos.announcements.create({
      courseId: 'course-1',
      title: 'Newest Notice',
      body: 'Posted today',
      postedAt: '2026-11-04T14:30:00.000Z',
    });
    const removed = await repos.announcements.create({
      courseId: 'course-1',
      title: 'Removed Notice',
      body: 'Soft deleted',
      postedAt: '2026-11-04T16:00:00.000Z',
    });
    await repos.announcements.update(removed.id, {
      title: removed.title,
      body: removed.body,
      deletedAt: '2026-11-04T17:00:00.000Z',
    });

    const result = await listAnnouncements.execute({ courseId: 'course-1' });
    expect(result.map((a) => a.title)).toEqual(['Newest Notice', 'Older Notice']);
  });
});
