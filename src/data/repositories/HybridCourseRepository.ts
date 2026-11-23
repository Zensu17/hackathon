import { AppError } from '../../application/errors/AppError';
import type { Course, CourseFollow } from '../../domain/entities';
import type {
  CourseRepository,
  CreateCourseRecordInput,
  UpdateCourseRecordInput,
} from '../../domain/repositories';
import type { LiteLearnDb } from '../local/LiteLearnDb';
import {
  domainAnnouncementToLocal,
  domainDeadlineToLocal,
  domainMaterialToLocal,
  domainWeekToLocal,
} from '../mappers/contentMapper';
import {
  domainCourseFollowToLocal,
  domainCourseToLocal,
  localCourseFollowToDomain,
  localCourseToDomain,
} from '../mappers/courseMapper';
import type { SupabaseRemoteDataSource } from '../remote/SupabaseRemoteDataSource';
import { generateUuid } from './HybridAuthRepository';

function isNetworkFailure(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }
  const msg =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('offline')
  );
}

export class HybridCourseRepository implements CourseRepository {
  constructor(
    private readonly db: LiteLearnDb,
    private readonly remote: SupabaseRemoteDataSource | null,
  ) {}

  async listByClassId(classId: string): Promise<Course[]> {
    const rows = await this.db.courses
      .where('classId')
      .equals(classId)
      .toArray();
    return rows
      .filter((row) => row.deletedAt === null)
      .map(localCourseToDomain);
  }

  async getById(id: string): Promise<Course | null> {
    const row = await this.db.courses.get(id);
    if (!row || row.deletedAt !== null) {
      return null;
    }
    return localCourseToDomain(row);
  }

  async listFollowedCourseIds(userId: string): Promise<string[]> {
    const rows = await this.db.courseFollows
      .where('userId')
      .equals(userId)
      .toArray();
    return rows.map((row) => row.courseId);
  }

  async followCourse(userId: string, courseId: string): Promise<CourseFollow> {
    if (this.remote !== null) {
      try {
        const follow = await this.remote.insertCourseFollow(userId, courseId);
        const content = await this.remote.fetchFollowedCoursesContent([courseId]);

        await this.db.transaction(
          'rw',
          [
            this.db.courseFollows,
            this.db.weeks,
            this.db.materials,
            this.db.materialBlobs,
            this.db.deadlines,
            this.db.announcements,
          ],
          async () => {
            await this.db.courseFollows
              .where('[userId+courseId]')
              .equals([userId, courseId])
              .delete();
            await this.db.courseFollows.put(domainCourseFollowToLocal(follow));

            if (content.weeks.length > 0) {
              await this.db.weeks.bulkPut(content.weeks.map(domainWeekToLocal));
            }

            if (content.materials.length > 0) {
              const cachedBlobIds = new Set(
                await this.db.materialBlobs
                  .where('materialId')
                  .anyOf(content.materials.map((m) => m.id))
                  .primaryKeys(),
              );
              await this.db.materials.bulkPut(
                content.materials.map((material) =>
                  domainMaterialToLocal({
                    ...material,
                    isAvailableOffline: cachedBlobIds.has(material.id),
                  }),
                ),
              );
            }

            if (content.deadlines.length > 0) {
              await this.db.deadlines.bulkPut(
                content.deadlines.map(domainDeadlineToLocal),
              );
            }

            if (content.announcements.length > 0) {
              await this.db.announcements.bulkPut(
                content.announcements.map(domainAnnouncementToLocal),
              );
            }
          },
        );

        return follow;
      } catch (err) {
        if (!isNetworkFailure(err)) {
          throw err;
        }
      }
    }

    const nowIso = new Date().toISOString();
    return this.db.transaction(
      'rw',
      [this.db.courseFollows, this.db.syncQueue],
      async () => {
        const existing = await this.db.courseFollows
          .where('[userId+courseId]')
          .equals([userId, courseId])
          .first();
        const result: CourseFollow = existing
          ? localCourseFollowToDomain(existing)
          : {
              id: generateUuid(),
              userId,
              courseId,
              createdAt: nowIso,
            };

        if (!existing) {
          await this.db.courseFollows.put(domainCourseFollowToLocal(result));
        }

        if (this.remote !== null) {
          const entityId = `${userId}:${courseId}`;
          const stale = await this.db.syncQueue
            .where('entityId')
            .equals(entityId)
            .and((row) => row.entityType === 'course_follow')
            .primaryKeys();
          if (stale.length > 0) {
            await this.db.syncQueue.bulkDelete(stale);
          }
          await this.db.syncQueue.put({
            id: generateUuid(),
            entityType: 'course_follow',
            entityId,
            operation: 'upsert',
            payloadJson: JSON.stringify({ userId, courseId }),
            attempts: 0,
            lastError: null,
            nextRetryAt: null,
            createdAt: nowIso,
          });
        }

        return result;
      },
    );
  }

  async unfollowCourse(userId: string, courseId: string): Promise<void> {
    let queuedForSync = false;
    if (this.remote !== null) {
      try {
        await this.remote.deleteCourseFollow(userId, courseId);
      } catch (err) {
        if (!isNetworkFailure(err)) {
          throw err;
        }
        queuedForSync = true;
      }
    }

    const nowIso = new Date().toISOString();
    await this.db.transaction(
      'rw',
      [this.db.courseFollows, this.db.syncQueue],
      async () => {
        await this.db.courseFollows
          .where('[userId+courseId]')
          .equals([userId, courseId])
          .delete();

        if (queuedForSync) {
          const entityId = `${userId}:${courseId}`;
          const stale = await this.db.syncQueue
            .where('entityId')
            .equals(entityId)
            .and((row) => row.entityType === 'course_follow')
            .primaryKeys();
          if (stale.length > 0) {
            await this.db.syncQueue.bulkDelete(stale);
          }
          await this.db.syncQueue.put({
            id: generateUuid(),
            entityType: 'course_follow',
            entityId,
            operation: 'delete',
            payloadJson: JSON.stringify({ userId, courseId }),
            attempts: 0,
            lastError: null,
            nextRetryAt: null,
            createdAt: nowIso,
          });
        }
      },
    );
  }

  async create(input: CreateCourseRecordInput): Promise<Course> {
    if (this.remote !== null) {
      try {
        const created = await this.remote.createCourse(input);
        await this.db.courses.put(domainCourseToLocal(created));
        return created;
      } catch (err) {
        if (!isNetworkFailure(err)) {
          throw err;
        }
      }
    }

    const nowIso = new Date().toISOString();
    const created: Course = {
      id: generateUuid(),
      classId: input.classId,
      code: input.code,
      name: input.name,
      description: input.description,
      createdAt: nowIso,
      updatedAt: nowIso,
      deletedAt: null,
    };
    await this.db.transaction(
      'rw',
      [this.db.courses, this.db.syncQueue],
      async () => {
        await this.db.courses.put(domainCourseToLocal(created));
        await this.db.syncQueue.put({
          id: generateUuid(),
          entityType: 'course',
          entityId: created.id,
          operation: 'upsert',
          payloadJson: JSON.stringify(created),
          attempts: 0,
          lastError: null,
          nextRetryAt: null,
          createdAt: nowIso,
        });
      },
    );
    return created;
  }

  async update(id: string, input: UpdateCourseRecordInput): Promise<Course> {
    if (this.remote !== null) {
      try {
        const updated = await this.remote.updateCourse(id, input);
        await this.db.courses.put(domainCourseToLocal(updated));
        return updated;
      } catch (err) {
        if (!isNetworkFailure(err)) {
          throw err;
        }
      }
    }

    const existingRow = await this.db.courses.get(id);
    if (!existingRow) {
      throw new AppError('NOT_FOUND', 'Course not found.');
    }

    const nowIso = new Date().toISOString();
    const updated: Course = {
      ...localCourseToDomain(existingRow),
      code: input.code,
      name: input.name,
      description: input.description,
      deletedAt:
        input.deletedAt !== undefined ? input.deletedAt : existingRow.deletedAt,
      updatedAt: nowIso,
    };

    await this.db.transaction(
      'rw',
      [this.db.courses, this.db.syncQueue],
      async () => {
        await this.db.courses.put(domainCourseToLocal(updated));
        await this.db.syncQueue.put({
          id: generateUuid(),
          entityType: 'course',
          entityId: updated.id,
          operation: updated.deletedAt ? 'delete' : 'upsert',
          payloadJson: JSON.stringify(updated),
          attempts: 0,
          lastError: null,
          nextRetryAt: null,
          createdAt: nowIso,
        });
      },
    );
    return updated;
  }
}
