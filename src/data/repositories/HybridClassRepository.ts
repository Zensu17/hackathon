import { AppError } from '../../application/errors/AppError';
import type { Class, User } from '../../domain/entities';
import type {
  ClassOnboardingResult,
  ClassRepository,
  CreateClassForRepInput,
} from '../../domain/repositories';
import type { LiteLearnDb } from '../local/LiteLearnDb';
import {
  domainClassToLocal,
  localClassToDomain,
} from '../mappers/classMapper';
import { domainCourseToLocal } from '../mappers/courseMapper';
import {
  domainUserToLocal,
  localUserToDomain,
} from '../mappers/userMapper';
import type { SupabaseRemoteDataSource } from '../remote/SupabaseRemoteDataSource';
import { generateUuid } from './HybridAuthRepository';

export class HybridClassRepository implements ClassRepository {
  constructor(
    private readonly db: LiteLearnDb,
    private readonly remote: SupabaseRemoteDataSource | null,
  ) {}

  async getById(id: string): Promise<Class | null> {
    const row = await this.db.classes.get(id);
    if (!row || row.deletedAt !== null) {
      return null;
    }
    return localClassToDomain(row);
  }

  async joinByCode(
    userId: string,
    joinCode: string,
  ): Promise<ClassOnboardingResult> {
    const normalizedCode = joinCode.trim().toUpperCase();
    const nowIso = new Date().toISOString();

    if (this.remote !== null) {
      const result = await this.remote.joinClassByCode(normalizedCode);
      const classCourses = await this.remote.fetchCoursesByClassId(
        result.currentClass.id,
      );

      await this.db.transaction(
        'rw',
        [this.db.classes, this.db.courses, this.db.users, this.db.sessions],
        async () => {
          await this.db.classes.put(domainClassToLocal(result.currentClass));
          if (classCourses.length > 0) {
            await this.db.courses.bulkPut(classCourses.map(domainCourseToLocal));
          }
          await this.db.users.put(domainUserToLocal(result.user));
          await this.db.sessions.put({
            id: 'current',
            userId: result.user.id,
            updatedAt: nowIso,
          });
        },
      );

      return result;
    }

    return this.db.transaction(
      'rw',
      [this.db.classes, this.db.users, this.db.sessions],
      async () => {
        const userRow = await this.db.users.get(userId);
        if (!userRow || userRow.deletedAt !== null) {
          throw new AppError('NOT_FOUND', 'User account not found.');
        }

        const matchedRows = await this.db.classes
          .where('joinCode')
          .equals(normalizedCode)
          .toArray();
        const activeClassRow = matchedRows.find((row) => row.deletedAt === null);

        if (!activeClassRow) {
          throw new AppError('NOT_FOUND', 'No class matched that join code.');
        }

        const updatedUser: User = {
          ...localUserToDomain(userRow),
          classId: activeClassRow.id,
          role: 'student',
          updatedAt: nowIso,
        };

        await this.db.users.put(domainUserToLocal(updatedUser));
        await this.db.sessions.put({
          id: 'current',
          userId: updatedUser.id,
          updatedAt: nowIso,
        });

        return {
          user: updatedUser,
          currentClass: localClassToDomain(activeClassRow),
        };
      },
    );
  }

  async createForRep(
    userId: string,
    input: CreateClassForRepInput,
  ): Promise<ClassOnboardingResult> {
    const normalizedCode = input.joinCode.trim().toUpperCase();
    const trimmedName = input.name.trim();
    const nowIso = new Date().toISOString();

    if (this.remote !== null) {
      const result = await this.remote.createClassAsRep(
        trimmedName,
        normalizedCode,
      );

      await this.db.transaction(
        'rw',
        [this.db.classes, this.db.users, this.db.sessions],
        async () => {
          await this.db.classes.put(domainClassToLocal(result.currentClass));
          await this.db.users.put(domainUserToLocal(result.user));
          await this.db.sessions.put({
            id: 'current',
            userId: result.user.id,
            updatedAt: nowIso,
          });
        },
      );

      return result;
    }

    return this.db.transaction(
      'rw',
      [this.db.classes, this.db.users, this.db.sessions],
      async () => {
        const userRow = await this.db.users.get(userId);
        if (!userRow || userRow.deletedAt !== null) {
          throw new AppError('NOT_FOUND', 'User account not found.');
        }

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

        const createdClass: Class = {
          id: generateUuid(),
          name: trimmedName,
          joinCode: normalizedCode,
          createdByUserId: userId,
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        };

        const updatedUser: User = {
          ...localUserToDomain(userRow),
          classId: createdClass.id,
          role: 'rep',
          updatedAt: nowIso,
        };

        await this.db.classes.put(domainClassToLocal(createdClass));
        await this.db.users.put(domainUserToLocal(updatedUser));
        await this.db.sessions.put({
          id: 'current',
          userId: updatedUser.id,
          updatedAt: nowIso,
        });

        return {
          user: updatedUser,
          currentClass: createdClass,
        };
      },
    );
  }
}
