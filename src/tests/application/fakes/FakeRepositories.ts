import { AppError } from '../../../application/errors/AppError';
import type {
  Announcement,
  Class,
  Course,
  CourseFollow,
  Deadline,
  Material,
  MaterialAttachment,
  Note,
  SyncQueueItem,
  User,
  Week,
} from '../../../domain/entities';
import type {
  AnnouncementRepository,
  AuthRepository,
  ClassOnboardingResult,
  ClassRepository,
  CourseRepository,
  CreateAnnouncementRecordInput,
  CreateClassForRepInput,
  CreateCourseRecordInput,
  CreateDeadlineRecordInput,
  CreateMaterialRecordInput,
  CreateWeekRecordInput,
  DeadlineRepository,
  EnqueueSyncItemInput,
  MaterialRepository,
  NoteRepository,
  SignInCredentials,
  SignUpCredentials,
  SyncQueueRepository,
  UpdateAnnouncementRecordInput,
  UpdateCourseRecordInput,
  UpdateDeadlineRecordInput,
  UpdateMaterialRecordInput,
  UpdateWeekRecordInput,
  UpsertNoteRecordInput,
  WeekRepository,
} from '../../../domain/repositories';

interface StoredCredential {
  userId: string;
  password: string;
}

export class FakeAuthRepository implements AuthRepository {
  readonly users: Map<string, User>;
  readonly classes: Map<string, Class>;
  readonly credentialsByNim = new Map<string, StoredCredential>();
  currentUserId: string | null = null;
  private nextId = 1;

  constructor(
    sharedUsers: Map<string, User> = new Map(),
    sharedClasses: Map<string, Class> = new Map(),
  ) {
    this.users = sharedUsers;
    this.classes = sharedClasses;
  }

  async signUp(input: SignUpCredentials): Promise<User> {
    const normalizedNim = input.nim.trim().toUpperCase();
    if (this.credentialsByNim.has(normalizedNim)) {
      throw new AppError('DUPLICATE_NIM', 'This NIM is already registered. Try signing in.');
    }

    let matchedClass: Class | null = null;
    if (input.classCode && input.classCode.trim().length > 0) {
      const code = input.classCode.trim().toUpperCase();
      matchedClass =
        Array.from(this.classes.values()).find(
          (c) => c.deletedAt === null && c.joinCode === code,
        ) ?? null;
      if (!matchedClass && this.classes.size > 0) {
        throw new AppError('NOT_FOUND', 'No class matched that class code.');
      }
    }

    const now = '2026-11-04T08:00:00.000Z';
    const user: User = {
      id: `user-${this.nextId++}`,
      nim: normalizedNim,
      displayName: input.displayName,
      classId: matchedClass?.id ?? null,
      role: matchedClass ? 'student' : null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    this.users.set(user.id, user);
    this.credentialsByNim.set(normalizedNim, {
      userId: user.id,
      password: input.password,
    });
    this.currentUserId = user.id;
    return { ...user };
  }

  async signIn(input: SignInCredentials): Promise<User> {
    const normalizedNim = input.nim.trim().toUpperCase();
    const record = this.credentialsByNim.get(normalizedNim);
    if (!record || record.password !== input.password) {
      throw new AppError('AUTH_ERROR', 'NIM or password is incorrect.');
    }

    const user = this.users.get(record.userId);
    if (!user || user.deletedAt !== null) {
      throw new AppError('AUTH_ERROR', 'Account is not active.');
    }

    this.currentUserId = user.id;
    return { ...user };
  }

  async signOut(options?: { clearLocalData?: boolean }): Promise<void> {
    this.currentUserId = null;
    if (options?.clearLocalData) {
      this.credentialsByNim.clear();
      this.users.clear();
    }
  }

  async getCurrentUser(): Promise<User | null> {
    if (!this.currentUserId) {
      return null;
    }
    const user = this.users.get(this.currentUserId);
    if (!user || user.deletedAt !== null) {
      return null;
    }
    return { ...user };
  }
}

export class FakeClassRepository implements ClassRepository {
  readonly classes = new Map<string, Class>();
  readonly users: Map<string, User>;
  private nextId = 1;

  constructor(sharedUsers: Map<string, User>) {
    this.users = sharedUsers;
  }

  async getById(id: string): Promise<Class | null> {
    const found = this.classes.get(id);
    if (!found || found.deletedAt !== null) {
      return null;
    }
    return { ...found };
  }

  async joinByCode(userId: string, joinCode: string): Promise<ClassOnboardingResult> {
    const user = this.users.get(userId);
    if (!user || user.deletedAt !== null) {
      throw new AppError('NOT_FOUND', 'User account not found.');
    }

    const normalizedCode = joinCode.trim().toUpperCase();
    const matchedClass = Array.from(this.classes.values()).find(
      (item) => item.deletedAt === null && item.joinCode === normalizedCode,
    );

    if (!matchedClass) {
      throw new AppError('NOT_FOUND', 'No class matched that join code.');
    }

    const updatedUser: User = {
      ...user,
      classId: matchedClass.id,
      role: 'student',
      updatedAt: '2026-11-04T08:05:00.000Z',
    };
    this.users.set(userId, updatedUser);

    return {
      user: { ...updatedUser },
      currentClass: { ...matchedClass },
    };
  }

  async createForRep(
    userId: string,
    input: CreateClassForRepInput,
  ): Promise<ClassOnboardingResult> {
    const user = this.users.get(userId);
    if (!user || user.deletedAt !== null) {
      throw new AppError('NOT_FOUND', 'User account not found.');
    }

    const normalizedCode = input.joinCode.trim().toUpperCase();
    const collision = Array.from(this.classes.values()).some(
      (item) => item.deletedAt === null && item.joinCode === normalizedCode,
    );
    if (collision) {
      throw new AppError(
        'DUPLICATE_JOIN_CODE',
        'Join code is already assigned to another class.',
      );
    }

    const now = '2026-11-04T08:05:00.000Z';
    const createdClass: Class = {
      id: `class-${this.nextId++}`,
      name: input.name,
      joinCode: normalizedCode,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    const updatedUser: User = {
      ...user,
      classId: createdClass.id,
      role: 'rep',
      updatedAt: now,
    };

    this.classes.set(createdClass.id, createdClass);
    this.users.set(userId, updatedUser);

    return {
      user: { ...updatedUser },
      currentClass: { ...createdClass },
    };
  }
}

export class FakeCourseRepository implements CourseRepository {
  readonly courses = new Map<string, Course>();
  readonly follows = new Map<string, CourseFollow>();
  private nextId = 1;
  private nextFollowId = 1;

  async listByClassId(classId: string): Promise<Course[]> {
    return Array.from(this.courses.values())
      .filter((course) => course.classId === classId)
      .map((course) => ({ ...course }));
  }

  async getById(id: string): Promise<Course | null> {
    const found = this.courses.get(id);
    return found ? { ...found } : null;
  }

  async listFollowedCourseIds(userId: string): Promise<string[]> {
    return Array.from(this.follows.values())
      .filter((follow) => follow.userId === userId)
      .map((follow) => follow.courseId);
  }

  async followCourse(userId: string, courseId: string): Promise<CourseFollow> {
    const key = `${userId}:${courseId}`;
    const existing = this.follows.get(key);
    if (existing) {
      return { ...existing };
    }

    const created: CourseFollow = {
      id: `follow-${this.nextFollowId++}`,
      userId,
      courseId,
      createdAt: '2026-11-04T08:10:00.000Z',
    };
    this.follows.set(key, created);
    return { ...created };
  }

  async unfollowCourse(userId: string, courseId: string): Promise<void> {
    this.follows.delete(`${userId}:${courseId}`);
  }

  async create(input: CreateCourseRecordInput): Promise<Course> {
    const now = '2026-11-04T08:10:00.000Z';
    const created: Course = {
      id: `course-${this.nextId++}`,
      classId: input.classId,
      code: input.code,
      name: input.name,
      description: input.description,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.courses.set(created.id, created);
    return { ...created };
  }

  async update(id: string, input: UpdateCourseRecordInput): Promise<Course> {
    const existing = this.courses.get(id);
    if (!existing) {
      throw new AppError('NOT_FOUND', 'Course not found.');
    }

    const updated: Course = {
      ...existing,
      code: input.code,
      name: input.name,
      description: input.description,
      deletedAt: input.deletedAt !== undefined ? input.deletedAt : existing.deletedAt,
      updatedAt: '2026-11-04T08:20:00.000Z',
    };
    this.courses.set(id, updated);
    return { ...updated };
  }
}

export class FakeWeekRepository implements WeekRepository {
  readonly weeks = new Map<string, Week>();
  private nextId = 1;

  async listByCourseId(courseId: string): Promise<Week[]> {
    return Array.from(this.weeks.values())
      .filter((week) => week.courseId === courseId)
      .map((week) => ({ ...week }));
  }

  async getById(id: string): Promise<Week | null> {
    const found = this.weeks.get(id);
    return found ? { ...found } : null;
  }

  async create(input: CreateWeekRecordInput): Promise<Week> {
    const now = '2026-11-04T08:15:00.000Z';
    const created: Week = {
      id: `week-${this.nextId++}`,
      courseId: input.courseId,
      weekNumber: input.weekNumber,
      title: input.title,
      summary: input.summary,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.weeks.set(created.id, created);
    return { ...created };
  }

  async update(id: string, input: UpdateWeekRecordInput): Promise<Week> {
    const existing = this.weeks.get(id);
    if (!existing) {
      throw new AppError('NOT_FOUND', 'Week not found.');
    }

    const updated: Week = {
      ...existing,
      weekNumber: input.weekNumber,
      title: input.title,
      summary: input.summary,
      deletedAt: input.deletedAt !== undefined ? input.deletedAt : existing.deletedAt,
      updatedAt: '2026-11-04T08:25:00.000Z',
    };
    this.weeks.set(id, updated);
    return { ...updated };
  }
}

export class FakeMaterialRepository implements MaterialRepository {
  readonly materials = new Map<string, Material>();
  private nextId = 1;

  async listByCourseId(courseId: string): Promise<Material[]> {
    return Array.from(this.materials.values())
      .filter((material) => material.courseId === courseId)
      .map((material) => ({
        ...material,
        attachment: material.attachment ? { ...material.attachment } : null,
      }));
  }

  async listByWeekId(weekId: string): Promise<Material[]> {
    return Array.from(this.materials.values())
      .filter((material) => material.weekId === weekId)
      .map((material) => ({
        ...material,
        attachment: material.attachment ? { ...material.attachment } : null,
      }));
  }

  async getById(id: string): Promise<Material | null> {
    const found = this.materials.get(id);
    if (!found) {
      return null;
    }
    return {
      ...found,
      attachment: found.attachment ? { ...found.attachment } : null,
    };
  }

  async create(input: CreateMaterialRecordInput): Promise<Material> {
    const now = '2026-11-04T08:30:00.000Z';
    const materialId = `material-${this.nextId++}`;
    const attachment: MaterialAttachment | null = input.file
      ? {
          name: input.file.name,
          sizeBytes: input.file.sizeBytes,
          mimeType: input.file.mimeType || 'application/pdf',
          storagePath: `${input.courseId}/${materialId}/${input.file.name}`,
          remoteUrl: null,
        }
      : null;

    const created: Material = {
      id: materialId,
      courseId: input.courseId,
      weekId: input.weekId,
      title: input.title,
      description: input.description,
      externalUrl: input.externalUrl,
      attachment,
      isAvailableOffline: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    this.materials.set(created.id, created);
    return {
      ...created,
      attachment: created.attachment ? { ...created.attachment } : null,
    };
  }

  async update(id: string, input: UpdateMaterialRecordInput): Promise<Material> {
    const existing = this.materials.get(id);
    if (!existing) {
      throw new AppError('NOT_FOUND', 'Material not found.');
    }

    let attachment = existing.attachment;
    if (input.removeAttachment) {
      attachment = null;
    }
    if (input.file) {
      attachment = {
        name: input.file.name,
        sizeBytes: input.file.sizeBytes,
        mimeType: input.file.mimeType || 'application/pdf',
        storagePath: `${existing.courseId}/${existing.id}/${input.file.name}`,
        remoteUrl: null,
      };
    }

    const updated: Material = {
      ...existing,
      weekId: input.weekId,
      title: input.title,
      description: input.description,
      externalUrl: input.externalUrl,
      attachment,
      deletedAt: input.deletedAt !== undefined ? input.deletedAt : existing.deletedAt,
      updatedAt: '2026-11-04T08:35:00.000Z',
    };

    this.materials.set(id, updated);
    return {
      ...updated,
      attachment: updated.attachment ? { ...updated.attachment } : null,
    };
  }
}

export class FakeDeadlineRepository implements DeadlineRepository {
  readonly deadlines = new Map<string, Deadline>();
  listByCourseIdsCalls = 0;
  private nextId = 1;

  async listByCourseIds(courseIds: readonly string[]): Promise<Deadline[]> {
    this.listByCourseIdsCalls += 1;
    const allowed = new Set(courseIds);
    return Array.from(this.deadlines.values())
      .filter((deadline) => allowed.has(deadline.courseId))
      .map((deadline) => ({ ...deadline }));
  }

  async listByCourseId(courseId: string): Promise<Deadline[]> {
    return Array.from(this.deadlines.values())
      .filter((deadline) => deadline.courseId === courseId)
      .map((deadline) => ({ ...deadline }));
  }

  async getById(id: string): Promise<Deadline | null> {
    const found = this.deadlines.get(id);
    return found ? { ...found } : null;
  }

  async create(input: CreateDeadlineRecordInput): Promise<Deadline> {
    const now = '2026-11-04T08:40:00.000Z';
    const created: Deadline = {
      id: `deadline-${this.nextId++}`,
      courseId: input.courseId,
      weekId: input.weekId,
      title: input.title,
      description: input.description,
      dueAt: input.dueAt,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.deadlines.set(created.id, created);
    return { ...created };
  }

  async update(id: string, input: UpdateDeadlineRecordInput): Promise<Deadline> {
    const existing = this.deadlines.get(id);
    if (!existing) {
      throw new AppError('NOT_FOUND', 'Deadline not found.');
    }

    const updated: Deadline = {
      ...existing,
      weekId: input.weekId,
      title: input.title,
      description: input.description,
      dueAt: input.dueAt,
      deletedAt: input.deletedAt !== undefined ? input.deletedAt : existing.deletedAt,
      updatedAt: '2026-11-04T08:45:00.000Z',
    };
    this.deadlines.set(id, updated);
    return { ...updated };
  }
}

export class FakeAnnouncementRepository implements AnnouncementRepository {
  readonly announcements = new Map<string, Announcement>();
  private nextId = 1;

  async listByCourseId(courseId: string): Promise<Announcement[]> {
    return Array.from(this.announcements.values())
      .filter((announcement) => announcement.courseId === courseId)
      .map((announcement) => ({ ...announcement }));
  }

  async getById(id: string): Promise<Announcement | null> {
    const found = this.announcements.get(id);
    return found ? { ...found } : null;
  }

  async create(input: CreateAnnouncementRecordInput): Promise<Announcement> {
    const now = '2026-11-04T08:50:00.000Z';
    const created: Announcement = {
      id: `announcement-${this.nextId++}`,
      courseId: input.courseId,
      title: input.title,
      body: input.body,
      postedAt: input.postedAt ?? now,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.announcements.set(created.id, created);
    return { ...created };
  }

  async update(id: string, input: UpdateAnnouncementRecordInput): Promise<Announcement> {
    const existing = this.announcements.get(id);
    if (!existing) {
      throw new AppError('NOT_FOUND', 'Announcement not found.');
    }

    const updated: Announcement = {
      ...existing,
      title: input.title,
      body: input.body,
      postedAt: input.postedAt ?? existing.postedAt,
      deletedAt: input.deletedAt !== undefined ? input.deletedAt : existing.deletedAt,
      updatedAt: '2026-11-04T08:55:00.000Z',
    };
    this.announcements.set(id, updated);
    return { ...updated };
  }
}

export class FakeNoteRepository implements NoteRepository {
  readonly notes = new Map<string, Note>();
  private nextId = 1;

  async getByMaterialId(userId: string, materialId: string): Promise<Note | null> {
    const found = this.notes.get(`${userId}:${materialId}`);
    if (!found || found.deletedAt !== null) {
      return null;
    }
    return { ...found };
  }

  async upsert(input: UpsertNoteRecordInput): Promise<Note> {
    const key = `${input.userId}:${input.materialId}`;
    const existing = this.notes.get(key);
    const now = '2026-11-04T09:00:00.000Z';

    if (existing) {
      const updated: Note = {
        ...existing,
        body: input.body,
        deletedAt: null,
        updatedAt: now,
      };
      this.notes.set(key, updated);
      return { ...updated };
    }

    const created: Note = {
      id: `note-${this.nextId++}`,
      userId: input.userId,
      materialId: input.materialId,
      body: input.body,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.notes.set(key, created);
    return { ...created };
  }
}

export class FakeSyncQueueRepository implements SyncQueueRepository {
  readonly items = new Map<string, SyncQueueItem>();
  private nextId = 1;

  async listPending(nowIso?: string): Promise<SyncQueueItem[]> {
    const nowMs = nowIso ? Date.parse(nowIso) : Number.POSITIVE_INFINITY;
    return Array.from(this.items.values())
      .filter((item) => {
        if (!item.nextRetryAt) {
          return true;
        }
        return Date.parse(item.nextRetryAt) <= nowMs;
      })
      .map((item) => ({ ...item }));
  }

  async countPending(): Promise<number> {
    return this.items.size;
  }

  async enqueue(input: EnqueueSyncItemInput): Promise<SyncQueueItem> {
    const created: SyncQueueItem = {
      id: `sync-${this.nextId++}`,
      entityType: input.entityType,
      entityId: input.entityId,
      operation: input.operation,
      payloadJson: input.payloadJson,
      attempts: 0,
      lastError: null,
      nextRetryAt: null,
      createdAt: '2026-11-04T09:05:00.000Z',
    };
    this.items.set(created.id, created);
    return { ...created };
  }

  async markFailed(
    id: string,
    errorMessage: string,
    nextRetryAt: string,
  ): Promise<void> {
    const existing = this.items.get(id);
    if (!existing) {
      return;
    }
    this.items.set(id, {
      ...existing,
      attempts: existing.attempts + 1,
      lastError: errorMessage,
      nextRetryAt,
    });
  }

  async remove(id: string): Promise<void> {
    this.items.delete(id);
  }
}

export interface FakeRepositoryBundle {
  users: Map<string, User>;
  auth: FakeAuthRepository;
  classes: FakeClassRepository;
  courses: FakeCourseRepository;
  weeks: FakeWeekRepository;
  materials: FakeMaterialRepository;
  deadlines: FakeDeadlineRepository;
  announcements: FakeAnnouncementRepository;
  notes: FakeNoteRepository;
  syncQueue: FakeSyncQueueRepository;
}

export function createFakeRepositories(): FakeRepositoryBundle {
  const users = new Map<string, User>();
  const classRepo = new FakeClassRepository(users);
  return {
    users,
    auth: new FakeAuthRepository(users, classRepo.classes),
    classes: classRepo,
    courses: new FakeCourseRepository(),
    weeks: new FakeWeekRepository(),
    materials: new FakeMaterialRepository(),
    deadlines: new FakeDeadlineRepository(),
    announcements: new FakeAnnouncementRepository(),
    notes: new FakeNoteRepository(),
    syncQueue: new FakeSyncQueueRepository(),
  };
}
