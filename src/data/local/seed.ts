import type { LiteLearnDb } from './LiteLearnDb';

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

// Populate clearly fake sample records only when explicitly requested in local fallback mode.
export async function seedInitialLocalDemo(db: LiteLearnDb): Promise<void> {
  const classId = 'seed-class-a';
  const joinCode = 'CLASSA';
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  // 1. Ensure Class A exists
  const existingClass = await db.classes.get(classId);
  if (!existingClass) {
    await db.classes.put({
      id: classId,
      name: 'Class A',
      joinCode,
      createdByUserId: 'seed-user-1',
      createdAt: nowIso,
      updatedAt: nowIso,
      deletedAt: null,
    });
  }

  // 2. Ensure default local accounts exist for Student, Class Rep, Lecturer, and Admin.
  const existingStudent = await db.users.get('seed-user-1');
  const existingRep = await db.users.get('seed-user-rep');
  const existingLecturer = await db.users.get('seed-user-lecturer');
  const existingAdmin = await db.users.get('seed-user-admin');
  if (!existingStudent || !existingRep || !existingLecturer || !existingAdmin) {
    await db.transaction('rw', [db.users, db.localCredentials], async () => {
      if (!existingStudent) {
        await db.users.put({
          id: 'seed-user-1',
          nim: '11S22001',
          displayName: 'Demo Student',
          classId,
          role: 'student',
          studyProgram: 'B.Sc. Informatics',
          bio: 'Focused on offline weekly summaries and lab deadlines.',
          avatarColor: '#2563EB',
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        });

        await db.localCredentials.put({
          nim: '11S22001',
          userId: 'seed-user-1',
          // SHA-256 hash of 'litelearn:11S22001:password123'
          passwordHash:
            '517f829ce9f46826da7ba84cf0446ccd14fc571ef19d5c07626fb871e736df2d',
          createdAt: nowIso,
        });
      }

      if (!existingRep) {
        await db.users.put({
          id: 'seed-user-rep',
          nim: '11S22002',
          displayName: 'Demo Class Rep',
          classId,
          role: 'rep',
          studyProgram: 'B.Sc. Informatics',
          bio: 'Class representative organizing weekly outlines and deadlines.',
          avatarColor: '#B45309',
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        });

        await db.localCredentials.put({
          nim: '11S22002',
          userId: 'seed-user-rep',
          // SHA-256 hash of 'litelearn:11S22002:password123'
          passwordHash:
            '851835ae623f30d3c4ba91075f1d81f0c202b6655f8597390a6dd83d5211fd02',
          createdAt: nowIso,
        });
      }

      if (!existingLecturer) {
        await db.users.put({
          id: 'seed-user-lecturer',
          nim: '01D10001',
          displayName: 'Dr. Hendra Situmorang',
          classId,
          role: 'lecturer',
          studyProgram: 'Faculty of Informatics',
          bio: 'Course coordinator for Algorithms and Data Structures.',
          avatarColor: '#0F766E',
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        });

        await db.localCredentials.put({
          nim: '01D10001',
          userId: 'seed-user-lecturer',
          // SHA-256 hash of 'litelearn:01D10001:password123'
          passwordHash:
            '03c6738c10f2e06816f210384a2886f644072eac30b82af183df7ffd9dd43c55',
          createdAt: nowIso,
        });
      }

      if (!existingAdmin) {
        await db.users.put({
          id: 'seed-user-admin',
          nim: '00A00001',
          displayName: 'Academic Admin',
          classId,
          role: 'admin',
          studyProgram: 'Academic Operations',
          bio: 'Manages classes, courses, and member permissions.',
          avatarColor: '#6D28D9',
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        });

        await db.localCredentials.put({
          nim: '00A00001',
          userId: 'seed-user-admin',
          // SHA-256 hash of 'litelearn:00A00001:password123'
          passwordHash:
            'f2e85f31f77ff640b8d978d80392e2101e1768168116322ed29cdfe690ed7a36',
          createdAt: nowIso,
        });
      }
    });
  }

  // 3. Ensure demo courses and content are populated for Class A
  const courseCount = await db.courses.where('classId').equals(classId).count();
  if (courseCount === 0) {
    await seedSampleClassData(db, 'seed-user-1');
  }

  // 4. Ensure all students in Class A follow at least Course A and Course B for active demo
  const usersInClass = await db.users.where('classId').equals(classId).toArray();
  for (const user of usersInClass) {
    const existingFollow = await db.courseFollows
      .where('userId')
      .equals(user.id)
      .first();
    if (!existingFollow) {
      await db.courseFollows.bulkPut([
        {
          id: `seed-follow-${user.id}-seed-course-a`,
          userId: user.id,
          courseId: 'seed-course-a',
          createdAt: nowIso,
        },
        {
          id: `seed-follow-${user.id}-seed-course-b`,
          userId: user.id,
          courseId: 'seed-course-b',
          createdAt: nowIso,
        },
      ]);
    }
  }
}

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
  const courseCId = 'seed-course-c';
  const courseDId = 'seed-course-d';
  const week1Id = 'seed-course-a-week-1';
  const week2Id = 'seed-course-a-week-2';
  const week3Id = 'seed-course-a-week-3';

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
          name: 'Algorithms and Data Structures',
          description:
            'Linear data structures, binary trees, graphs, and algorithm efficiency.',
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
        {
          id: courseBId,
          classId,
          code: 'CRS-102',
          name: 'Object-Oriented Programming',
          description:
            'Encapsulation, inheritance, polymorphism, and modular design patterns.',
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
        {
          id: courseCId,
          classId,
          code: 'CRS-103',
          name: 'Database Systems',
          description:
            'Relational data modeling, schema normalization, SQL optimization, and ACID transactions.',
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
        {
          id: courseDId,
          classId,
          code: 'CRS-104',
          name: 'Computer Networks',
          description:
            'TCP/IP protocol architecture, subnetting, routing, and network performance analysis.',
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
      ]);

      await db.courseFollows.bulkPut([
        {
          id: `seed-follow-${userId}-${courseAId}`,
          userId,
          courseId: courseAId,
          createdAt: nowIso,
        },
        {
          id: `seed-follow-${userId}-${courseBId}`,
          userId,
          courseId: courseBId,
          createdAt: nowIso,
        },
      ]);

      await db.weeks.bulkPut([
        {
          id: week1Id,
          courseId: courseAId,
          weekNumber: 1,
          title: 'Week 1: Introduction & Algorithm Complexity',
          summary: 'Big-O notation, runtime analysis, and search case studies.',
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
        {
          id: week2Id,
          courseId: courseAId,
          weekNumber: 2,
          title: 'Week 2: Linear Data Structures (Stack & Queue)',
          summary: 'Queue and stack implementations and arithmetic expression evaluation.',
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
        {
          id: week3Id,
          courseId: courseAId,
          weekNumber: 3,
          title: 'Week 3: Binary Trees & Binary Search Tree',
          summary: 'Hierarchical tree structures and pre-order, in-order, and post-order traversals.',
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
        {
          id: 'seed-course-b-week-1',
          courseId: courseBId,
          weekNumber: 1,
          title: 'Week 1: Classes, Objects, and Encapsulation',
          summary: 'Domain entity modeling, access modifiers, and clean constructor design.',
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
          title: 'Lecture Notes: Asymptotic Analysis & Big-O',
          description:
            'Concise guide to estimating algorithm complexity for offline study.',
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
          title: 'Lecture Slides: Stack & Queue Implementation',
          description:
            'Summary of memory layouts and push, pop, enqueue, and dequeue operations.',
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
        {
          id: 'seed-material-3',
          courseId: courseAId,
          weekId: week3Id,
          title: 'Lab Module: Binary Search Tree',
          description:
            'Binary tree implementation walkthrough and offline graph traversal exercises.',
          externalUrl: null,
          attachmentName: 'crs101-week3-bst.pdf',
          attachmentSizeBytes: 318000,
          attachmentMimeType: 'application/pdf',
          attachmentStoragePath: `${classId}/${courseAId}/seed-material-3/crs101-week3-bst.pdf`,
          attachmentRemoteUrl: null,
          isAvailableOffline: false,
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
        {
          id: 'seed-material-4',
          courseId: courseBId,
          weekId: 'seed-course-b-week-1',
          title: 'Study Summary: Encapsulation & Object Invariants',
          description:
            'Lightweight text summary on internal state protection, safe accessors, and a Student class example.',
          externalUrl: null,
          attachmentName: 'crs102-week1-encapsulation.pdf',
          attachmentSizeBytes: 245760,
          attachmentMimeType: 'application/pdf',
          attachmentStoragePath: `${classId}/${courseBId}/seed-material-4/crs102-week1-encapsulation.pdf`,
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
          title: 'Pre-Lab Assignment 1: Algorithm Analysis',
          description: 'Submit a concise complexity summary for binary search algorithms.',
          dueAt: new Date(nowMs - 6 * ONE_HOUR_MS).toISOString(),
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
        {
          id: 'seed-deadline-due-soon',
          courseId: courseAId,
          weekId: week2Id,
          title: 'Short Quiz 1: Stack & Queue',
          description: 'Online quiz covering stack and queue fundamentals.',
          dueAt: new Date(nowMs + 10 * ONE_HOUR_MS).toISOString(),
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
        {
          id: 'seed-deadline-scheduled',
          courseId: courseAId,
          weekId: null,
          title: 'Midterm Project: Mini Indexer',
          description: 'Build a keyword search utility backed by a binary search tree.',
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
          title: 'Weekly Lab Tutorial Schedule',
          body: 'Algorithm tutorial sessions run every Thursday evening in Computer Lab 2.',
          postedAt: new Date(nowMs - ONE_DAY_MS).toISOString(),
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
        {
          id: 'seed-announcement-2',
          courseId: courseAId,
          title: 'Pre-Lab Assignment Submission Reminder',
          body: 'Please upload your assignment file before 23:59 WIB.',
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
