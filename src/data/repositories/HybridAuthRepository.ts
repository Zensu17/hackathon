import { AppError } from '../../application/errors/AppError';
import type { User } from '../../domain/entities';
import type {
  AuthRepository,
  SignInCredentials,
  SignUpCredentials,
} from '../../domain/repositories';
import type { LiteLearnDb } from '../local/LiteLearnDb';
import { domainClassToLocal } from '../mappers/classMapper';
import {
  domainAnnouncementToLocal,
  domainDeadlineToLocal,
  domainMaterialToLocal,
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

async function hashLocalPassword(email: string, password: string): Promise<string> {
  const encoded = new TextEncoder().encode(`litelearn:${email}:${password}`);
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
    const normalizedEmail = input.email.trim().toLowerCase();
    const nowIso = new Date().toISOString();

    if (this.remote !== null) {
      const user = await this.remote.signUp({
        email: normalizedEmail,
        password: input.password,
        displayName: input.displayName,
      });

      await this.db.transaction('rw', [this.db.users, this.db.sessions], async () => {
        await this.db.users.put(domainUserToLocal(user));
        await this.db.sessions.put({
          id: 'current',
          userId: user.id,
          updatedAt: nowIso,
        });
      });

      return user;
    }

    const passwordHash = await hashLocalPassword(normalizedEmail, input.password);
    const createdUser: User = {
      id: generateUuid(),
      email: normalizedEmail,
      displayName: input.displayName.trim(),
      classId: null,
      role: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      deletedAt: null,
    };

    await this.db.transaction(
      'rw',
      [this.db.users, this.db.localCredentials, this.db.sessions],
      async () => {
        const existingCred = await this.db.localCredentials.get(normalizedEmail);
        if (existingCred) {
          throw new AppError(
            'AUTH_ERROR',
            'An account with this campus email already exists on this device.',
          );
        }

        await this.db.users.put(domainUserToLocal(createdUser));
        await this.db.localCredentials.put({
          email: normalizedEmail,
          userId: createdUser.id,
          passwordHash,
          createdAt: nowIso,
        });
        await this.db.sessions.put({
          id: 'current',
          userId: createdUser.id,
          updatedAt: nowIso,
        });
      },
    );

    return createdUser;
  }

  async signIn(input: SignInCredentials): Promise<User> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const nowIso = new Date().toISOString();

    if (this.remote !== null) {
      const user = await this.remote.signIn({
        email: normalizedEmail,
        password: input.password,
      });

      const [remoteClass, remoteCourses, remoteFollows] = await Promise.all([
        user.classId ? this.remote.fetchClassById(user.classId) : Promise.resolve(null),
        user.classId ? this.remote.fetchCoursesByClassId(user.classId) : Promise.resolve([]),
        this.remote.fetchCourseFollowsByUserId(user.id),
      ]);

      const followedCourseIds = remoteFollows.map((follow) => follow.courseId);
      const hydratedContent =
        await this.remote.fetchFollowedCoursesContent(followedCourseIds);

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
            const cachedBlobIds = new Set(
              (
                await this.db.materialBlobs
                  .where('materialId')
                  .anyOf(hydratedContent.materials.map((m) => m.id))
                  .primaryKeys()
              ),
            );

            await this.db.materials.bulkPut(
              hydratedContent.materials.map((material) =>
                domainMaterialToLocal({
                  ...material,
                  isAvailableOffline: cachedBlobIds.has(material.id),
                }),
              ),
            );
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
        },
      );

      return user;
    }

    const credential = await this.db.localCredentials.get(normalizedEmail);
    if (!credential) {
      throw new AppError('AUTH_ERROR', 'Invalid email or password.');
    }

    const expectedHash = await hashLocalPassword(normalizedEmail, input.password);
    if (expectedHash !== credential.passwordHash) {
      throw new AppError('AUTH_ERROR', 'Invalid email or password.');
    }

    const userRow = await this.db.users.get(credential.userId);
    if (!userRow || userRow.deletedAt !== null) {
      throw new AppError('AUTH_ERROR', 'User account is not active.');
    }

    await this.db.sessions.put({
      id: 'current',
      userId: userRow.id,
      updatedAt: nowIso,
    });

    return localUserToDomain(userRow);
  }

  async signOut(): Promise<void> {
    if (this.remote !== null) {
      try {
        await this.remote.signOut();
      } catch {
        // Clear local session even if remote sign-out fails while offline.
      }
    }
    await this.db.sessions.delete('current');
  }
}
