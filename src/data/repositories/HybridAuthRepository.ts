import { AppError } from '../../application/errors/AppError';
import type { Class, User, UserRole } from '../../domain/entities';
import type {
  AdminCreateUserInput,
  AdminResetPasswordInput,
  AdminSetUserActiveInput,
  AdminUpdateUserInput,
  AuthRepository,
  ChangeOwnPasswordInput,
  SignInCredentials,
  SignOutOptions,
  SignUpCredentials,
  UpdateProfileRecordInput,
} from '../../domain/repositories';
import { isAdminRole } from '../../domain/rules';
import type { LiteLearnDb } from '../local/LiteLearnDb';
import {
  domainClassToLocal,
  localClassToDomain,
} from '../mappers/classMapper';
import {
  domainAnnouncementToLocal,
  domainDeadlineToLocal,
  domainMaterialToLocal,
  domainNoteToLocal,
  domainWeekToLocal,
} from '../mappers/contentMapper';
import {
  domainCourseFollowToLocal,
  domainCourseToLocal,
} from '../mappers/courseMapper';
import {
  domainUserToLocal,
  localUserToDomain,
} from '../mappers/userMapper';
import type { SupabaseRemoteDataSource } from '../remote/SupabaseRemoteDataSource';
import { getPendingBlobMaterialIds } from './syncQueueHelpers';

export function generateUuid(): string {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.getRandomValues === 'function'
  ) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

// Pure JS SHA-256 fallback for plain HTTP LAN origins where Web Crypto subtle is unavailable.
function sha256PureJs(bytes: Uint8Array): string {
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  const w = new Uint32Array(64);
  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const w15 = w[i - 15] ?? 0;
      const w2 = w[i - 2] ?? 0;
      const s0 =
        rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 =
        rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] = (((w[i - 16] ?? 0) + s0 + (w[i - 7] ?? 0) + s1) >>> 0);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i += 1) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + (SHA256_K[i] ?? 0) + (w[i] ?? 0)) >>> 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((word) => word.toString(16).padStart(8, '0'))
    .join('');
}

async function hashLocalPassword(nim: string, password: string): Promise<string> {
  const encoded = new TextEncoder().encode(`litelearn:${nim}:${password}`);
  if (
    typeof globalThis.crypto !== 'undefined' &&
    globalThis.crypto.subtle &&
    typeof globalThis.crypto.subtle.digest === 'function'
  ) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');
  }
  return sha256PureJs(encoded);
}

const ROLE_SORT_PRIORITY: Record<UserRole, number> = {
  admin: 0,
  lecturer: 1,
  assistant: 2,
  rep: 3,
  student: 4,
};

export class HybridAuthRepository implements AuthRepository {
  constructor(
    private readonly db: LiteLearnDb,
    private readonly remote: SupabaseRemoteDataSource | null,
  ) {}

  async getCurrentUser(): Promise<User | null> {
    const session = await this.db.sessions.get('current');
    if (!session) {
      return null;
    }

    const row = await this.db.users.get(session.userId);
    if (!row || row.deletedAt !== null) {
      return null;
    }

    return localUserToDomain(row);
  }

  async signUp(input: SignUpCredentials): Promise<User> {
    const normalizedNim = input.nim.trim().toUpperCase();
    const nowIso = new Date().toISOString();

    if (this.remote !== null) {
      const { user, currentClass } = await this.remote.signUp({
        nim: normalizedNim,
        password: input.password,
        displayName: input.displayName,
        classCode: input.classCode,
      });

      const remoteCourses = currentClass
        ? await this.remote.fetchCoursesByClassId(currentClass.id)
        : [];

      await this.db.transaction(
        'rw',
        [this.db.users, this.db.sessions, this.db.classes, this.db.courses],
        async () => {
          await this.db.users.put(domainUserToLocal(user));
          await this.db.sessions.put({
            id: 'current',
            userId: user.id,
            updatedAt: nowIso,
          });
          if (currentClass) {
            await this.db.classes.put(domainClassToLocal(currentClass));
          }
          if (remoteCourses.length > 0) {
            await this.db.courses.bulkPut(remoteCourses.map(domainCourseToLocal));
          }
        },
      );

      return user;
    }

    const normalizedCode = input.classCode.trim().toUpperCase();
    let matchedClass = await this.db.classes
      .where('joinCode')
      .equals(normalizedCode)
      .first();

    let createdLocalClass = false;

    if (!matchedClass && normalizedCode === 'CLASSA') {
      matchedClass = {
        id: 'seed-class-a',
        name: 'Class A',
        joinCode: 'CLASSA',
        createdByUserId: 'system',
        createdAt: nowIso,
        updatedAt: nowIso,
        deletedAt: null,
      };
      await this.db.classes.put(matchedClass);
    }

    if (matchedClass && matchedClass.deletedAt !== null) {
      throw new AppError('NOT_FOUND', 'No class matched that class code.');
    }

    const createdUserId = generateUuid();

    if (!matchedClass) {
      if (!/^[A-Z0-9][A-Z0-9-]{2,15}$/.test(normalizedCode)) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Class code must be 3 to 16 letters, digits, or hyphens.',
        );
      }
      matchedClass = {
        id: generateUuid(),
        name: `Class ${normalizedCode}`,
        joinCode: normalizedCode,
        createdByUserId: createdUserId,
        createdAt: nowIso,
        updatedAt: nowIso,
        deletedAt: null,
      };
      createdLocalClass = true;
    }

    const passwordHash = await hashLocalPassword(normalizedNim, input.password);
    const createdUser: User = {
      id: createdUserId,
      nim: normalizedNim,
      displayName: input.displayName.trim(),
      classId: matchedClass.id,
      role: 'student',
      createdAt: nowIso,
      updatedAt: nowIso,
      deletedAt: null,
    };

    await this.db.transaction(
      'rw',
      [
        this.db.users,
        this.db.localCredentials,
        this.db.sessions,
        this.db.classes,
        this.db.courseFollows,
      ],
      async () => {
        const existingCred = await this.db.localCredentials.get(normalizedNim);
        if (existingCred) {
          throw new AppError(
            'DUPLICATE_NIM',
            'This NIM is already registered. Try signing in.',
          );
        }

        if (createdLocalClass && matchedClass) {
          await this.db.classes.put(matchedClass);
        }
        await this.db.users.put(domainUserToLocal(createdUser));
        await this.db.localCredentials.put({
          nim: normalizedNim,
          userId: createdUser.id,
          passwordHash,
          createdAt: nowIso,
        });
        await this.db.sessions.put({
          id: 'current',
          userId: createdUser.id,
          updatedAt: nowIso,
        });

        if (matchedClass.id === 'seed-class-a') {
          await this.db.courseFollows.bulkPut([
            {
              id: `seed-follow-${createdUser.id}-seed-course-a`,
              userId: createdUser.id,
              courseId: 'seed-course-a',
              createdAt: nowIso,
            },
            {
              id: `seed-follow-${createdUser.id}-seed-course-b`,
              userId: createdUser.id,
              courseId: 'seed-course-b',
              createdAt: nowIso,
            },
          ]);
        }
      },
    );

    return createdUser;
  }

  async signIn(input: SignInCredentials): Promise<User> {
    const normalizedNim = input.nim.trim().toUpperCase();
    const nowIso = new Date().toISOString();

    if (this.remote !== null) {
      const user = await this.remote.signIn({
        nim: normalizedNim,
        password: input.password,
      });

      const [remoteClass, remoteCourses, remoteFollows, remoteNotes] =
        await Promise.all([
          user.classId ? this.remote.fetchClassById(user.classId) : Promise.resolve(null),
          user.classId ? this.remote.fetchCoursesByClassId(user.classId) : Promise.resolve([]),
          this.remote.fetchCourseFollowsByUserId(user.id),
          this.remote.fetchUserNotes(user.id),
        ]);

      const followedCourseIds = remoteFollows.map((follow) => follow.courseId);
      const [hydratedContent, pendingBlobIds] = await Promise.all([
        this.remote.fetchFollowedCoursesContent(followedCourseIds),
        getPendingBlobMaterialIds(this.db),
      ]);

      await this.db.transaction(
        'rw',
        [
          this.db.users,
          this.db.sessions,
          this.db.classes,
          this.db.courses,
          this.db.courseFollows,
          this.db.weeks,
          this.db.materials,
          this.db.materialBlobs,
          this.db.deadlines,
          this.db.announcements,
          this.db.notes,
        ],
        async () => {
          await this.db.users.put(domainUserToLocal(user));
          await this.db.sessions.put({
            id: 'current',
            userId: user.id,
            updatedAt: nowIso,
          });

          if (remoteClass) {
            await this.db.classes.put(domainClassToLocal(remoteClass));
          }

          if (remoteCourses.length > 0) {
            await this.db.courses.bulkPut(remoteCourses.map(domainCourseToLocal));
          }

          await this.db.courseFollows.where('userId').equals(user.id).delete();
          if (remoteFollows.length > 0) {
            await this.db.courseFollows.bulkPut(
              remoteFollows.map(domainCourseFollowToLocal),
            );
          }

          if (hydratedContent.weeks.length > 0) {
            await this.db.weeks.bulkPut(
              hydratedContent.weeks.map(domainWeekToLocal),
            );
          }

          if (hydratedContent.materials.length > 0) {
            const existingLocalMaterials = await this.db.materials
              .where('id')
              .anyOf(hydratedContent.materials.map((m) => m.id))
              .toArray();
            const existingById = new Map(
              existingLocalMaterials.map((row) => [row.id, row]),
            );
            const cachedBlobIds = new Set(
              await this.db.materialBlobs
                .where('materialId')
                .anyOf(hydratedContent.materials.map((m) => m.id))
                .primaryKeys(),
            );
            const staleBlobIds: string[] = [];

            const nextMaterials = hydratedContent.materials.map((material) => {
              const localRow = existingById.get(material.id);
              const attachmentChanged =
                material.deletedAt !== null ||
                material.attachment === null ||
                (localRow !== undefined &&
                  (localRow.attachmentStoragePath !==
                    material.attachment.storagePath ||
                    localRow.attachmentSizeBytes !==
                      material.attachment.sizeBytes ||
                    localRow.attachmentName !== material.attachment.name));

              if (
                attachmentChanged &&
                cachedBlobIds.has(material.id) &&
                !pendingBlobIds.has(material.id)
              ) {
                staleBlobIds.push(material.id);
                cachedBlobIds.delete(material.id);
              }

              return domainMaterialToLocal({
                ...material,
                isAvailableOffline:
                  material.deletedAt === null &&
                  material.attachment !== null &&
                  cachedBlobIds.has(material.id),
              });
            });

            if (staleBlobIds.length > 0) {
              await this.db.materialBlobs.bulkDelete(staleBlobIds);
            }
            await this.db.materials.bulkPut(nextMaterials);
          }

          if (hydratedContent.deadlines.length > 0) {
            await this.db.deadlines.bulkPut(
              hydratedContent.deadlines.map(domainDeadlineToLocal),
            );
          }

          if (hydratedContent.announcements.length > 0) {
            await this.db.announcements.bulkPut(
              hydratedContent.announcements.map(domainAnnouncementToLocal),
            );
          }

          // Reconcile remote notes by [userId+materialId] so mismatched local UUIDs never duplicate rows.
          for (const remoteNote of remoteNotes) {
            const existingNotes = await this.db.notes
              .where('[userId+materialId]')
              .equals([remoteNote.userId, remoteNote.materialId])
              .toArray();
            const staleIds = existingNotes
              .map((row) => row.id)
              .filter((id) => id !== remoteNote.id);
            if (staleIds.length > 0) {
              await this.db.notes.bulkDelete(staleIds);
            }
            await this.db.notes.put(domainNoteToLocal(remoteNote));
          }
        },
      );

      return user;
    }

    const credential = await this.db.localCredentials.get(normalizedNim);
    if (!credential) {
      throw new AppError('AUTH_ERROR', 'NIM or password is incorrect.');
    }

    const expectedHash = await hashLocalPassword(normalizedNim, input.password);
    if (expectedHash !== credential.passwordHash) {
      throw new AppError('AUTH_ERROR', 'NIM or password is incorrect.');
    }

    const userRow = await this.db.users.get(credential.userId);
    if (!userRow || userRow.deletedAt !== null) {
      throw new AppError('AUTH_ERROR', 'NIM or password is incorrect.');
    }

    await this.db.sessions.put({
      id: 'current',
      userId: userRow.id,
      updatedAt: nowIso,
    });

    return localUserToDomain(userRow);
  }

  async signOut(options?: SignOutOptions): Promise<void> {
    if (this.remote !== null) {
      try {
        await this.remote.signOut();
      } catch {
        // Clear local session even if remote sign-out fails while offline.
      }
    }

    const activeSession = await this.db.sessions.get('current');
    if (activeSession && !options?.clearLocalData) {
      // Tag any legacy unscoped queue items with the outgoing userId so they never replay under another user.
      const queuedRows = await this.db.syncQueue.toArray();
      const unscopedRows = queuedRows.filter((row) => !row.userId);
      if (unscopedRows.length > 0) {
        await this.db.syncQueue.bulkPut(
          unscopedRows.map((row) => ({ ...row, userId: activeSession.userId })),
        );
      }
      if (this.db.meta && typeof this.db.meta.delete === 'function') {
        await this.db.meta.delete('last_sync_at');
        await this.db.meta.delete('last_sync_user_id');
      }
    }

    await this.db.sessions.delete('current');

    if (options?.clearLocalData) {
      await Promise.all([
        this.db.users.clear(),
        this.db.sessions.clear(),
        this.db.localCredentials.clear(),
        this.db.classes.clear(),
        this.db.courses.clear(),
        this.db.courseFollows.clear(),
        this.db.weeks.clear(),
        this.db.materials.clear(),
        this.db.materialBlobs.clear(),
        this.db.deadlines.clear(),
        this.db.announcements.clear(),
        this.db.notes.clear(),
        this.db.syncQueue.clear(),
        this.db.meta.clear(),
        this.db.deadlineCompletions?.clear(),
      ]);
      this.db.notifySyncQueueChanged?.();
      this.db.notifyDeadlineCompletionsChanged?.();
    }
  }

  async updateProfile(input: UpdateProfileRecordInput): Promise<User> {
    const nowIso = new Date().toISOString();

    if (this.remote !== null) {
      const remoteUser = await this.remote.updateProfile(input);
      const mergedLocal: User = {
        ...remoteUser,
        ...(input.studyProgram !== undefined
          ? { studyProgram: input.studyProgram }
          : {}),
        ...(input.bio !== undefined ? { bio: input.bio } : {}),
        ...(input.avatarColor !== undefined
          ? { avatarColor: input.avatarColor }
          : {}),
        ...(input.avatarDataUrl !== undefined
          ? { avatarDataUrl: input.avatarDataUrl }
          : {}),
      };
      await this.db.users.put(domainUserToLocal(mergedLocal));
      return mergedLocal;
    }

    const existingRow = await this.db.users.get(input.userId);
    if (!existingRow || existingRow.deletedAt !== null) {
      throw new AppError('NOT_FOUND', 'User account not found.');
    }

    const nextRow = {
      ...existingRow,
      displayName: input.displayName.trim(),
      updatedAt: nowIso,
      ...(input.studyProgram !== undefined
        ? { studyProgram: input.studyProgram }
        : {}),
      ...(input.bio !== undefined ? { bio: input.bio } : {}),
      ...(input.avatarColor !== undefined
        ? { avatarColor: input.avatarColor }
        : {}),
      ...(input.avatarDataUrl !== undefined
        ? { avatarDataUrl: input.avatarDataUrl }
        : {}),
    };

    await this.db.users.put(nextRow);
    return localUserToDomain(nextRow);
  }

  private sortUsersForDirectory(users: User[]): User[] {
    return [...users].sort((a, b) => {
      const inactiveA = a.deletedAt !== null ? 1 : 0;
      const inactiveB = b.deletedAt !== null ? 1 : 0;
      if (inactiveA !== inactiveB) {
        return inactiveA - inactiveB;
      }
      const rankA = a.role ? ROLE_SORT_PRIORITY[a.role] : 99;
      const rankB = b.role ? ROLE_SORT_PRIORITY[b.role] : 99;
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return a.displayName.localeCompare(b.displayName);
    });
  }

  private async requireActiveAdmin(actorId: string) {
    const actorRow = await this.db.users.get(actorId);
    if (
      !actorRow ||
      actorRow.deletedAt !== null ||
      !isAdminRole(actorRow.role)
    ) {
      throw new AppError(
        'FORBIDDEN_ROLE',
        'Only an active Administrator can manage users and roles.',
      );
    }
    return actorRow;
  }

  private async countActiveAdmins(): Promise<number> {
    const rows = await this.db.users.toArray();
    return rows.filter(
      (row) => row.deletedAt === null && row.role === 'admin',
    ).length;
  }

  async listClassMembers(classId: string): Promise<User[]> {
    const trimmedClassId = classId.trim();
    if (trimmedClassId.length === 0) {
      return [];
    }

    if (this.remote !== null) {
      try {
        const allUsers = await this.remote.adminListAllUsers();
        const members = allUsers.filter(
          (user) => user.classId === trimmedClassId && user.deletedAt === null,
        );
        return this.sortUsersForDirectory(members);
      } catch {
        // Fallback to local cache when caller is not an Admin
      }
    }

    const rows = await this.db.users
      .where('classId')
      .equals(trimmedClassId)
      .toArray();

    return this.sortUsersForDirectory(
      rows.filter((row) => row.deletedAt === null).map(localUserToDomain),
    );
  }

  async listAllUsers(actorId: string): Promise<User[]> {
    if (this.remote !== null) {
      const users = await this.remote.adminListAllUsers();
      return this.sortUsersForDirectory(users);
    }

    await this.requireActiveAdmin(actorId);
    const rows = await this.db.users.toArray();
    return this.sortUsersForDirectory(rows.map(localUserToDomain));
  }

  async listAllClasses(actorId: string): Promise<Class[]> {
    if (this.remote !== null) {
      return this.remote.adminListAllClasses();
    }

    await this.requireActiveAdmin(actorId);
    const rows = await this.db.classes.toArray();
    return rows
      .filter((row) => row.deletedAt === null)
      .map(localClassToDomain)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async adminCreateUser(input: AdminCreateUserInput): Promise<User> {
    if (this.remote !== null) {
      throw new AppError(
        'FORBIDDEN_ROLE',
        'In online mode, new users register as Student first and Admin assigns their role here.',
      );
    }

    await this.requireActiveAdmin(input.actorId);

    const normalizedNim = input.nim.trim().toUpperCase();
    const nowIso = new Date().toISOString();
    const targetClassId =
      input.classId && input.classId.trim().length > 0
        ? input.classId.trim()
        : null;

    if (targetClassId !== null) {
      const classRow = await this.db.classes.get(targetClassId);
      if (!classRow || classRow.deletedAt !== null) {
        throw new AppError('NOT_FOUND', 'Selected class was not found.');
      }
    }

    const passwordHash = await hashLocalPassword(normalizedNim, input.password);
    const createdUser: User = {
      id: generateUuid(),
      nim: normalizedNim,
      displayName: input.displayName.trim(),
      classId: targetClassId,
      role: input.role,
      ...(input.studyProgram !== undefined && input.studyProgram.trim().length > 0
        ? { studyProgram: input.studyProgram.trim() }
        : {}),
      createdAt: nowIso,
      updatedAt: nowIso,
      deletedAt: null,
    };

    await this.db.transaction(
      'rw',
      [this.db.users, this.db.localCredentials, this.db.courseFollows],
      async () => {
        const existingCred = await this.db.localCredentials.get(normalizedNim);
        if (existingCred) {
          throw new AppError(
            'DUPLICATE_NIM',
            'This NIM is already registered. Try editing that user instead.',
          );
        }

        await this.db.users.put(domainUserToLocal(createdUser));
        await this.db.localCredentials.put({
          nim: normalizedNim,
          userId: createdUser.id,
          passwordHash,
          createdAt: nowIso,
        });

        if (targetClassId === 'seed-class-a') {
          await this.db.courseFollows.bulkPut([
            {
              id: `seed-follow-${createdUser.id}-seed-course-a`,
              userId: createdUser.id,
              courseId: 'seed-course-a',
              createdAt: nowIso,
            },
            {
              id: `seed-follow-${createdUser.id}-seed-course-b`,
              userId: createdUser.id,
              courseId: 'seed-course-b',
              createdAt: nowIso,
            },
          ]);
        }
      },
    );

    return createdUser;
  }

  async adminUpdateUser(input: AdminUpdateUserInput): Promise<User> {
    if (this.remote !== null) {
      const updated = await this.remote.adminUpdateUser({
        targetUserId: input.targetUserId,
        displayName: input.displayName,
        role: input.role,
        classId: input.classId,
        studyProgram: input.studyProgram,
        bio: input.bio,
      });
      await this.db.users.put(domainUserToLocal(updated));
      return updated;
    }

    await this.requireActiveAdmin(input.actorId);

    const targetRow = await this.db.users.get(input.targetUserId);
    if (!targetRow) {
      throw new AppError('NOT_FOUND', 'Target user was not found.');
    }

    if (
      targetRow.deletedAt === null &&
      targetRow.role === 'admin' &&
      input.role !== undefined &&
      input.role !== 'admin'
    ) {
      const activeAdmins = await this.countActiveAdmins();
      if (activeAdmins <= 1) {
        throw new AppError(
          'FORBIDDEN_ROLE',
          'Cannot remove the Admin role from the last active Administrator.',
        );
      }
    }

    if (input.classId !== undefined && input.classId !== null) {
      const classRow = await this.db.classes.get(input.classId);
      if (!classRow || classRow.deletedAt !== null) {
        throw new AppError('NOT_FOUND', 'Selected class was not found.');
      }
    }

    const updatedRow = {
      ...targetRow,
      displayName:
        input.displayName !== undefined
          ? input.displayName.trim()
          : targetRow.displayName,
      role: input.role !== undefined ? input.role : targetRow.role,
      classId: input.classId !== undefined ? input.classId : targetRow.classId,
      studyProgram:
        input.studyProgram !== undefined
          ? input.studyProgram.trim()
          : targetRow.studyProgram,
      bio: input.bio !== undefined ? input.bio.trim() : targetRow.bio,
      updatedAt: new Date().toISOString(),
    };

    await this.db.users.put(updatedRow);
    return localUserToDomain(updatedRow);
  }

  async adminSetUserActive(input: AdminSetUserActiveInput): Promise<User> {
    if (this.remote !== null) {
      const updated = await this.remote.adminSetUserActive({
        targetUserId: input.targetUserId,
        active: input.active,
      });
      await this.db.users.put(domainUserToLocal(updated));
      return updated;
    }

    await this.requireActiveAdmin(input.actorId);

    if (input.actorId === input.targetUserId && !input.active) {
      throw new AppError(
        'FORBIDDEN_ROLE',
        'You cannot deactivate your own admin account.',
      );
    }

    const targetRow = await this.db.users.get(input.targetUserId);
    if (!targetRow) {
      throw new AppError('NOT_FOUND', 'Target user was not found.');
    }

    if (!input.active && targetRow.deletedAt === null && targetRow.role === 'admin') {
      const activeAdmins = await this.countActiveAdmins();
      if (activeAdmins <= 1) {
        throw new AppError(
          'FORBIDDEN_ROLE',
          'Cannot deactivate the last active Administrator.',
        );
      }
    }

    const nowIso = new Date().toISOString();
    const updatedRow = {
      ...targetRow,
      deletedAt: input.active ? null : nowIso,
      updatedAt: nowIso,
    };

    await this.db.users.put(updatedRow);
    return localUserToDomain(updatedRow);
  }

  async adminResetPassword(input: AdminResetPasswordInput): Promise<void> {
    if (this.remote !== null) {
      throw new AppError(
        'FORBIDDEN_ROLE',
        'Password resets in online mode require Supabase Auth Admin.',
      );
    }

    await this.requireActiveAdmin(input.actorId);

    const targetRow = await this.db.users.get(input.targetUserId);
    if (!targetRow) {
      throw new AppError('NOT_FOUND', 'Target user was not found.');
    }

    const nowIso = new Date().toISOString();
    const passwordHash = await hashLocalPassword(targetRow.nim, input.newPassword);
    await this.db.localCredentials.put({
      nim: targetRow.nim,
      userId: targetRow.id,
      passwordHash,
      createdAt: nowIso,
    });
  }

  async adminCreateClass(
    actorId: string,
    name: string,
    joinCode: string,
  ): Promise<Class> {
    const normalizedCode = joinCode.trim().toUpperCase();
    const trimmedName = name.trim();

    if (this.remote !== null) {
      const created = await this.remote.adminCreateClass(
        trimmedName,
        normalizedCode,
      );
      await this.db.classes.put(domainClassToLocal(created));
      return created;
    }

    await this.requireActiveAdmin(actorId);

    const existingRows = await this.db.classes
      .where('joinCode')
      .equals(normalizedCode)
      .toArray();
    const collision = existingRows.some((row) => row.deletedAt === null);
    if (collision) {
      throw new AppError(
        'DUPLICATE_JOIN_CODE',
        'Join code is already assigned to another class.',
      );
    }

    const nowIso = new Date().toISOString();
    const createdClass: Class = {
      id: generateUuid(),
      name: trimmedName,
      joinCode: normalizedCode,
      createdByUserId: actorId,
      createdAt: nowIso,
      updatedAt: nowIso,
      deletedAt: null,
    };

    await this.db.classes.put(domainClassToLocal(createdClass));
    return createdClass;
  }

  async changeOwnPassword(input: ChangeOwnPasswordInput): Promise<void> {
    const userRow = await this.db.users.get(input.userId);
    if (!userRow || userRow.deletedAt !== null) {
      throw new AppError('NOT_FOUND', 'User account not found.');
    }

    if (this.remote !== null) {
      await this.remote.changeOwnPassword(
        userRow.nim,
        input.currentPassword,
        input.newPassword,
      );
      return;
    }

    const credential = await this.db.localCredentials.get(userRow.nim);
    if (!credential) {
      throw new AppError('AUTH_ERROR', 'Local credentials were not found.');
    }

    const currentHash = await hashLocalPassword(
      userRow.nim,
      input.currentPassword,
    );
    if (currentHash !== credential.passwordHash) {
      throw new AppError('AUTH_ERROR', 'Current password is incorrect.');
    }

    const nextHash = await hashLocalPassword(userRow.nim, input.newPassword);
    await this.db.localCredentials.put({
      ...credential,
      passwordHash: nextHash,
    });
  }

  async updateMemberRole(
    actorId: string,
    targetUserId: string,
    nextRole: UserRole,
  ): Promise<User> {
    return this.adminUpdateUser({
      actorId,
      targetUserId,
      role: nextRole,
    });
  }
}
