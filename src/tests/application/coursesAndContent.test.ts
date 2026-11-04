import { describe, expect, it } from 'vitest';
import {
  FollowCourse,
  GetCourseWeeks,
  GetMaterial,
  ListCourses,
  UnfollowCourse,
} from '../../application/usecases';
import { createFakeRepositories } from './fakes/FakeRepositories';

describe('Courses and weekly content use cases', () => {
  it('lists active class courses sorted by code with follow status and toggles following idempotently', async () => {
    const repos = createFakeRepositories();
    const listCourses = new ListCourses(repos.courses);
    const followCourse = new FollowCourse(repos.courses);
    const unfollowCourse = new UnfollowCourse(repos.courses);

    const courseB = await repos.courses.create({
      classId: 'class-1',
      code: 'CRS-102',
      name: 'Course B',
      description: 'Second sample course',
    });
    const courseA = await repos.courses.create({
      classId: 'class-1',
      code: 'CRS-101',
      name: 'Course A',
      description: 'First sample course',
    });
    const deletedCourse = await repos.courses.create({
      classId: 'class-1',
      code: 'CRS-099',
      name: 'Removed Course',
      description: 'Soft deleted',
    });
    await repos.courses.update(deletedCourse.id, {
      code: deletedCourse.code,
      name: deletedCourse.name,
      description: deletedCourse.description,
      deletedAt: '2026-11-04T09:00:00.000Z',
    });

    await followCourse.execute({ userId: 'user-1', courseId: courseA.id });
    await followCourse.execute({ userId: 'user-1', courseId: courseA.id });

    const listed = await listCourses.execute({
      classId: 'class-1',
      userId: 'user-1',
    });

    expect(listed.map((c) => c.code)).toEqual(['CRS-101', 'CRS-102']);
    expect(listed[0]?.isFollowed).toBe(true);
    expect(listed[1]?.id).toBe(courseB.id);
    expect(listed[1]?.isFollowed).toBe(false);

    await unfollowCourse.execute({ userId: 'user-1', courseId: courseA.id });
    await unfollowCourse.execute({ userId: 'user-1', courseId: courseA.id });

    const afterUnfollow = await listCourses.execute({
      classId: 'class-1',
      userId: 'user-1',
    });
    expect(afterUnfollow[0]?.isFollowed).toBe(false);
  });

  it('orders GetCourseWeeks ascending by weekNumber, excludes soft-deleted children, and annotates deadlines', async () => {
    const repos = createFakeRepositories();
    const fixedNow = '2026-11-05T12:00:00.000Z';
    const getCourseWeeks = new GetCourseWeeks(
      repos.courses,
      repos.weeks,
      repos.materials,
      repos.deadlines,
      () => fixedNow,
    );

    const course = await repos.courses.create({
      classId: 'class-1',
      code: 'CRS-101',
      name: 'Course A',
      description: 'Sample course',
    });
    await repos.courses.followCourse('user-1', course.id);

    const week2 = await repos.weeks.create({
      courseId: course.id,
      weekNumber: 2,
      title: 'Week 2',
      summary: 'Second week',
    });
    const week1 = await repos.weeks.create({
      courseId: course.id,
      weekNumber: 1,
      title: 'Week 1',
      summary: 'First week',
    });
    const deletedWeek = await repos.weeks.create({
      courseId: course.id,
      weekNumber: 3,
      title: 'Week 3',
      summary: 'Removed week',
    });
    await repos.weeks.update(deletedWeek.id, {
      weekNumber: 3,
      title: 'Week 3',
      summary: 'Removed week',
      deletedAt: '2026-11-05T10:00:00.000Z',
    });

    const activeMaterial = await repos.materials.create({
      courseId: course.id,
      weekId: week1.id,
      title: 'Week 1 Notes',
      description: 'Core concepts',
      externalUrl: null,
    });
    const deletedMaterial = await repos.materials.create({
      courseId: course.id,
      weekId: week1.id,
      title: 'Draft Notes',
      description: 'Hidden',
      externalUrl: null,
    });
    await repos.materials.update(deletedMaterial.id, {
      weekId: week1.id,
      title: 'Draft Notes',
      description: 'Hidden',
      externalUrl: null,
      deletedAt: '2026-11-05T10:00:00.000Z',
    });

    await repos.deadlines.create({
      courseId: course.id,
      weekId: week1.id,
      title: 'Due Soon Quiz',
      description: 'Submit before midnight',
      dueAt: '2026-11-05T20:00:00.000Z',
    });
    await repos.deadlines.create({
      courseId: course.id,
      weekId: week1.id,
      title: 'Past Worksheet',
      description: 'Earlier task',
      dueAt: '2026-11-05T06:00:00.000Z',
    });
    await repos.deadlines.create({
      courseId: course.id,
      weekId: null,
      title: 'Midterm Project',
      description: 'Course-level deadline',
      dueAt: '2026-11-10T12:00:00.000Z',
    });

    const result = await getCourseWeeks.execute({
      courseId: course.id,
      userId: 'user-1',
    });

    expect(result.isFollowed).toBe(true);
    expect(result.weeks.map((w) => w.weekNumber)).toEqual([1, 2]);
    expect(result.weeks[0]?.id).toBe(week1.id);
    expect(result.weeks[1]?.id).toBe(week2.id);
    expect(result.weeks[0]?.materials.map((m) => m.id)).toEqual([activeMaterial.id]);

    expect(result.weeks[0]?.deadlines.map((d) => d.title)).toEqual([
      'Past Worksheet',
      'Due Soon Quiz',
    ]);
    expect(result.weeks[0]?.deadlines[0]?.isOverdue).toBe(true);
    expect(result.weeks[0]?.deadlines[0]?.isDueSoon).toBe(false);
    expect(result.weeks[0]?.deadlines[1]?.isOverdue).toBe(false);
    expect(result.weeks[0]?.deadlines[1]?.isDueSoon).toBe(true);

    expect(result.unassignedDeadlines).toHaveLength(1);
    expect(result.unassignedDeadlines[0]?.title).toBe('Midterm Project');
  });

  it('returns MaterialDetailDto for active materials and throws NOT_FOUND when missing or soft-deleted', async () => {
    const repos = createFakeRepositories();
    const getMaterial = new GetMaterial(
      repos.materials,
      repos.courses,
      repos.weeks,
    );

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
      title: 'Handout 1',
      description: 'Summary text',
      externalUrl: 'https://del.ac.id/handout',
    });

    const detail = await getMaterial.execute({ materialId: material.id });
    expect(detail.material.id).toBe(material.id);
    expect(detail.course.code).toBe('CRS-101');
    expect(detail.week.weekNumber).toBe(1);

    await repos.materials.update(material.id, {
      weekId: week.id,
      title: material.title,
      description: material.description,
      externalUrl: material.externalUrl,
      deletedAt: '2026-11-05T11:00:00.000Z',
    });

    await expect(
      getMaterial.execute({ materialId: material.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await expect(
      getMaterial.execute({ materialId: 'unknown-id' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
