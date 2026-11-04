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

  // 2. Ensure default demo student account exists if users table is empty
  const userCount = await db.users.count();
  if (userCount === 0) {
    await db.transaction('rw', [db.users, db.localCredentials], async () => {
      await db.users.put({
        id: 'seed-user-1',
        nim: '11S22001',
        displayName: 'Demo Student',
        classId,
        role: 'student',
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
          name: 'Algoritma dan Struktur Data',
          description:
            'Struktur data linier, pohon biner, graf, dan efisiensi algoritma.',
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
        {
          id: courseBId,
          classId,
          code: 'CRS-102',
          name: 'Pemrograman Berorientasi Objek',
          description:
            'Prinsip enkapsulasi, pewarisan, polimorfisme, dan pola perancangan modular.',
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
        {
          id: courseCId,
          classId,
          code: 'CRS-103',
          name: 'Sistem Basis Data',
          description:
            'Model data relasional, normalisasi skema, optimasi SQL, dan transaksi ACID.',
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
        {
          id: courseDId,
          classId,
          code: 'CRS-104',
          name: 'Jaringan Komputer',
          description:
            'Arsitektur protokol TCP/IP, subnetting, routing, dan analisis performa jaringan.',
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
          title: 'Minggu 1: Pengenalan & Kompleksitas Algoritma',
          summary: 'Notasi Big-O, analisis waktu proses, dan studi kasus pencarian.',
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
        {
          id: week2Id,
          courseId: courseAId,
          weekNumber: 2,
          title: 'Minggu 2: Struktur Data Linear (Stack & Queue)',
          summary: 'Implementasi antrean, tumpukan, dan aplikasi evaluasi ekspresi aritmatika.',
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
        {
          id: week3Id,
          courseId: courseAId,
          weekNumber: 3,
          title: 'Minggu 3: Pohon Biner & Binary Search Tree',
          summary: 'Struktur data pohon hierarkis, algoritma traversal pre-order, in-order, dan post-order.',
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
          title: 'Catatan Kuliah: Analisis Asimptotik & Big-O',
          description:
            'Panduan lengkap estimasi kompleksitas algoritma untuk belajar offline.',
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
          title: 'Slide Kuliah: Implementasi Stack & Queue',
          description:
            'Rangkuman representasi memori dan operasi push, pop, enqueue, dequeue.',
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
          title: 'Modul Praktikum: Binary Search Tree',
          description:
            'Contoh implementasi pohon biner dan studi kasus traversal graf offline.',
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
      ]);

      await db.deadlines.bulkPut([
        {
          id: 'seed-deadline-overdue',
          courseId: courseAId,
          weekId: week1Id,
          title: 'Tugas Pendahuluan 1: Analisis Algoritma',
          description: 'Pengumpulan ringkasan kompleksitas algoritma pencarian biner.',
          dueAt: new Date(nowMs - 6 * ONE_HOUR_MS).toISOString(),
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
        {
          id: 'seed-deadline-due-soon',
          courseId: courseAId,
          weekId: week2Id,
          title: 'Kuis Singkat 1: Stack & Queue',
          description: 'Kuis daring pemahaman konsep tumpukan dan antrean.',
          dueAt: new Date(nowMs + 10 * ONE_HOUR_MS).toISOString(),
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
        {
          id: 'seed-deadline-scheduled',
          courseId: courseAId,
          weekId: null,
          title: 'Proyek Tengah Semester: Mini Indexer',
          description: 'Implementasi aplikasi pencarian kata kunci berbasis binary search tree.',
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
          title: 'Jadwal Tutorial Praktikum Lab Minggu Ini',
          body: 'Sesi responsi algoritma diadakan setiap Kamis malam di Lab Komputer 2.',
          postedAt: new Date(nowMs - ONE_DAY_MS).toISOString(),
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        },
        {
          id: 'seed-announcement-2',
          courseId: courseAId,
          title: 'Pemberitahuan Batas Unggah Tugas Pendahuluan',
          body: 'Harap submit berkas jawaban tepat waktu sebelum pukul 23:59 WIB.',
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
