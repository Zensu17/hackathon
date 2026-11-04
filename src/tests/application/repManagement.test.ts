import { describe, expect, it } from 'vitest';
import {
  CreateAnnouncement,
  CreateCourse,
  CreateDeadline,
  CreateMaterial,
  CreateWeek,
  UpdateAnnouncement,
  UpdateCourse,
  UpdateDeadline,
  UpdateMaterial,
  UpdateWeek,
} from '../../application/usecases';
import type { User } from '../../domain/entities';
import { MAX_MATERIAL_FILE_BYTES } from '../../domain/rules';
import { createFakeRepositories } from './fakes/FakeRepositories';

const repClassA: User = {
  id: 'rep-1',
  email: 'rep01@del.ac.id',
  displayName: 'Rep One',
  classId: 'class-a',
  role: 'rep',
  createdAt: '2026-11-04T08:00:00.000Z',
  updatedAt: '2026-11-04T08:00:00.000Z',
  deletedAt: null,
};

const studentClassA: User = {
  ...repClassA,
  id: 'student-1',
  email: 'student01@students.del.ac.id',
  role: 'student',
};

const repClassB: User = {
  ...repClassA,
  id: 'rep-2',
  email: 'rep02@del.ac.id',
  classId: 'class-b',
};

describe('Class representative management use cases', () => {
  it('enforces rep role and matching classId across all 10 Rep CRUD use cases', async () => {
    const repos = createFakeRepositories();
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

    const course = await createCourse.execute({
      actor: repClassA,
      classId: 'class-a',
      code: 'crs-101',
      name: 'Course A',
      description: 'Core class course',
    });
    expect(course.code).toBe('CRS-101');
    expect(await repos.courses.listFollowedCourseIds(repClassA.id)).toContain(
      course.id,
    );

    const week = await createWeek.execute({
      actor: repClassA,
      courseId: course.id,
      weekNumber: 1,
      title: 'Week 1',
      summary: 'Introductory reading',
    });

    const material = await createMaterial.execute({
      actor: repClassA,
      courseId: course.id,
      weekId: week.id,
      title: 'Handout 1',
      description: 'Summary text',
      externalUrl: 'https://del.ac.id/notes',
      file: {
        name: 'handout.pdf',
        sizeBytes: 1024,
        mimeType: 'application/pdf',
        bytes: new Uint8Array([1, 2, 3]),
      },
    });

    const deadline = await createDeadline.execute({
      actor: repClassA,
      courseId: course.id,
      weekId: week.id,
      title: 'Problem Set 1',
      description: 'Submit before midnight',
      dueAt: '2026-11-10T16:59:00.000Z',
    });

    const announcement = await createAnnouncement.execute({
      actor: repClassA,
      courseId: course.id,
      title: 'Room Update',
      body: 'Moved to GD-512',
    });

    for (const unauthorizedActor of [studentClassA, repClassB]) {
      await expect(
        createCourse.execute({
          actor: unauthorizedActor,
          classId: 'class-a',
          code: 'CRS-102',
          name: 'Course B',
          description: 'Blocked',
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN_ROLE' });

      await expect(
        updateCourse.execute({
          actor: unauthorizedActor,
          courseId: course.id,
          code: 'CRS-101',
          name: 'Edited',
          description: 'Blocked',
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN_ROLE' });

      await expect(
        createWeek.execute({
          actor: unauthorizedActor,
          courseId: course.id,
          weekNumber: 2,
          title: 'Week 2',
          summary: 'Blocked',
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN_ROLE' });

      await expect(
        updateWeek.execute({
          actor: unauthorizedActor,
          weekId: week.id,
          weekNumber: 1,
          title: 'Edited Week',
          summary: 'Blocked',
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN_ROLE' });

      await expect(
        createMaterial.execute({
          actor: unauthorizedActor,
          courseId: course.id,
          weekId: week.id,
          title: 'Blocked Material',
          description: 'Blocked',
          externalUrl: null,
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN_ROLE' });

      await expect(
        updateMaterial.execute({
          actor: unauthorizedActor,
          materialId: material.id,
          weekId: week.id,
          title: 'Blocked Edit',
          description: 'Blocked',
          externalUrl: null,
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN_ROLE' });

      await expect(
        createDeadline.execute({
          actor: unauthorizedActor,
          courseId: course.id,
          weekId: null,
          title: 'Blocked Deadline',
          description: 'Blocked',
          dueAt: '2026-11-12T10:00:00.000Z',
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN_ROLE' });

      await expect(
        updateDeadline.execute({
          actor: unauthorizedActor,
          deadlineId: deadline.id,
          weekId: null,
          title: 'Blocked Deadline Edit',
          description: 'Blocked',
          dueAt: '2026-11-12T10:00:00.000Z',
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN_ROLE' });

      await expect(
        createAnnouncement.execute({
          actor: unauthorizedActor,
          courseId: course.id,
          title: 'Blocked Notice',
          body: 'Blocked',
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN_ROLE' });

      await expect(
        updateAnnouncement.execute({
          actor: unauthorizedActor,
          announcementId: announcement.id,
          title: 'Blocked Notice Edit',
          body: 'Blocked',
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN_ROLE' });
    }

    const updatedCourse = await updateCourse.execute({
      actor: repClassA,
      courseId: course.id,
      code: 'crs-101a',
      name: 'Course A Revised',
      description: 'Updated description',
    });
    expect(updatedCourse.code).toBe('CRS-101A');

    const updatedWeek = await updateWeek.execute({
      actor: repClassA,
      weekId: week.id,
      weekNumber: 1,
      title: 'Week 1 Revised',
      summary: 'Updated summary',
    });
    expect(updatedWeek.title).toBe('Week 1 Revised');

    const updatedMaterial = await updateMaterial.execute({
      actor: repClassA,
      materialId: material.id,
      weekId: week.id,
      title: 'Handout 1 Revised',
      description: 'Updated notes',
      externalUrl: null,
      removeAttachment: true,
    });
    expect(updatedMaterial.attachment).toBeNull();

    const updatedDeadline = await updateDeadline.execute({
      actor: repClassA,
      deadlineId: deadline.id,
      weekId: null,
      title: 'Problem Set 1 Revised',
      description: 'Course-level submission',
      dueAt: '2026-11-11T16:59:00.000Z',
    });
    expect(updatedDeadline.weekId).toBeNull();

    const updatedAnnouncement = await updateAnnouncement.execute({
      actor: repClassA,
      announcementId: announcement.id,
      title: 'Room Update Revised',
      body: 'Confirmed GD-512',
    });
    expect(updatedAnnouncement.title).toBe('Room Update Revised');
  });

  it('validates PDF size/type boundaries and externalUrl protocols on CreateMaterial and UpdateMaterial', async () => {
    const repos = createFakeRepositories();
    const createCourse = new CreateCourse(repos.courses);
    const createWeek = new CreateWeek(repos.courses, repos.weeks);
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

    const course = await createCourse.execute({
      actor: repClassA,
      classId: 'class-a',
      code: 'CRS-101',
      name: 'Course A',
      description: 'Sample',
    });
    const week = await createWeek.execute({
      actor: repClassA,
      courseId: course.id,
      weekNumber: 1,
      title: 'Week 1',
      summary: 'Sample',
    });

    await expect(
      createMaterial.execute({
        actor: repClassA,
        courseId: course.id,
        weekId: week.id,
        title: 'Oversized PDF',
        description: 'Too large',
        externalUrl: null,
        file: {
          name: 'slides.pdf',
          sizeBytes: MAX_MATERIAL_FILE_BYTES + 1,
          mimeType: 'application/pdf',
          bytes: new Uint8Array([1]),
        },
      }),
    ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });

    await expect(
      createMaterial.execute({
        actor: repClassA,
        courseId: course.id,
        weekId: week.id,
        title: 'Wrong Type',
        description: 'Archive',
        externalUrl: null,
        file: {
          name: 'slides.zip',
          sizeBytes: 1024,
          mimeType: 'application/zip',
          bytes: new Uint8Array([1]),
        },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_FILE_TYPE' });

    await expect(
      createMaterial.execute({
        actor: repClassA,
        courseId: course.id,
        weekId: week.id,
        title: 'Unsafe Link',
        description: 'Script URI',
        externalUrl: 'javascript:alert(1)',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    const created = await createMaterial.execute({
      actor: repClassA,
      courseId: course.id,
      weekId: week.id,
      title: 'Exact Limit PDF',
      description: 'Max size allowed',
      externalUrl: 'https://del.ac.id/reference',
      file: {
        name: 'exact.pdf',
        sizeBytes: MAX_MATERIAL_FILE_BYTES,
        mimeType: 'application/pdf',
        bytes: new Uint8Array([1, 2]),
      },
    });
    expect(created.attachment?.sizeBytes).toBe(MAX_MATERIAL_FILE_BYTES);

    await expect(
      updateMaterial.execute({
        actor: repClassA,
        materialId: created.id,
        weekId: week.id,
        title: 'Bad Update',
        description: 'Invalid attachment',
        externalUrl: null,
        file: {
          name: 'photo.png',
          sizeBytes: 512,
          mimeType: 'image/png',
          bytes: new Uint8Array([1]),
        },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_FILE_TYPE' });
  });
});
