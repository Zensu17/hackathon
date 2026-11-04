import type { LiteLearnDb } from './LiteLearnDb';

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

// Populate clearly fake sample records only when explicitly requested in local fallback mode.
export async function seedSampleClassData(
  db: LiteLearnDb,
  userId: string,
): Promise<{ classId: string; joinCode: string }> {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const classId = 'seed-class-a';
  const joinCode = 'CLASSA';
  const courseAId = 'seed-course-a';
  const courseBId = 'seed-course-b';
  const week1Id = 'seed-course-a-week-1';
  const week2Id = 'seed-course-a-week-2';

  await db.transaction(
    'rw',
    [
      db.users,
      db.sessions,
      db.classes,
      db.courses,
      db.courseFollows,
      db.weeks,
      db.materials,
      db.deadlines,
      db.announcements,
    ],
    async () => {
      await db.classes.put({
        id: classId,
        name: 'Class A',
        joinCode,
        createdByUserId: userId,
        createdAt: nowIso,
        updatedAt: nowIso,
        deletedAt: null,
      });

      const existingUser = await db.users.get(userId);
      if (existingUser) {
        await db.users.put({
          ...existingUser,
          classId,
          role: existingUser.role ?? 'rep',
          updatedAt: nowIso,
        });
      }

      await db.courses.bulkPut([
        {
          id: courseAId,
          classId,
          code: 'CRS-101',
          name: 'Course A',
          description: 'Sample followed course for local offline testing.',
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
        {
          id: courseBId,
          classId,
          code: 'CRS-102',
          name: 'Course B',
          description: 'Sample unfollowed course for follow toggle testing.',
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
      ]);

      await db.courseFollows.put({
        id: `seed-follow-${userId}-${courseAId}`,
        userId,
        courseId: courseAId,
        createdAt: nowIso,
      });

      await db.weeks.bulkPut([
        {
          id: week1Id,
          courseId: courseAId,
          weekNumber: 1,
          title: 'Week 1',
          summary: 'Sample Week 1 index entry for Course A.',
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
        {
          id: week2Id,
          courseId: courseAId,
          weekNumber: 2,
          title: 'Week 2',
          summary: 'Sample Week 2 index entry for Course A.',
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
      ]);

      await db.materials.bulkPut([
        {
          id: 'seed-material-1',
          courseId: courseAId,
          weekId: week1Id,
          title: 'Sample Material 1 (Course A)',
          description:
            'Sample study notes with fake PDF metadata for offline inspection.',
          externalUrl: null,
          attachmentName: 'crs101-week1-outline.pdf',
          attachmentSizeBytes: 420864,
          attachmentMimeType: 'application/pdf',
          attachmentStoragePath: `${classId}/${courseAId}/seed-material-1/crs101-week1-outline.pdf`,
          attachmentRemoteUrl: null,
          isAvailableOffline: false,
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
        {
          id: 'seed-material-2',
          courseId: courseAId,
          weekId: week2Id,
          title: 'Sample Material 2 (Course A)',
          description:
            'Sample text summary with an external reference link for Week 2.',
          externalUrl: 'https://example.org/course-a-week-2',
          attachmentName: null,
          attachmentSizeBytes: null,
          attachmentMimeType: null,
          attachmentStoragePath: null,
          attachmentRemoteUrl: null,
          isAvailableOffline: false,
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
      ]);

      await db.deadlines.bulkPut([
        {
          id: 'seed-deadline-overdue',
          courseId: courseAId,
          weekId: week1Id,
          title: 'Sample Worksheet 1 (Course A)',
          description: 'Sample past-due item dated 6 hours ago.',
          dueAt: new Date(nowMs - 6 * ONE_HOUR_MS).toISOString(),
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
        {
          id: 'seed-deadline-due-soon',
          courseId: courseAId,
          weekId: week2Id,
          title: 'Sample Quiz 1 (Course A)',
          description: 'Sample item due in 10 hours within the 24-hour window.',
          dueAt: new Date(nowMs + 10 * ONE_HOUR_MS).toISOString(),
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
        {
          id: 'seed-deadline-scheduled',
          courseId: courseAId,
          weekId: null,
          title: 'Sample Project Milestone (Course A)',
          description: 'Sample course-level item due in 5 days.',
          dueAt: new Date(nowMs + 5 * ONE_DAY_MS).toISOString(),
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
      ]);

      await db.announcements.bulkPut([
        {
          id: 'seed-announcement-1',
          courseId: courseAId,
          title: 'Sample Announcement 1 (Course A)',
          body: 'Earlier sample notice for Course A.',
          postedAt: new Date(nowMs - ONE_DAY_MS).toISOString(),
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
        {
          id: 'seed-announcement-2',
          courseId: courseAId,
          title: 'Sample Announcement 2 (Course A)',
          body: 'Newest sample notice for Course A.',
          postedAt: nowIso,
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
      ]);
    },
  );

  return { classId, joinCode };
}
