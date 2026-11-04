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
    }

    return this.db.transaction('rw', this.db.courseFollows, async () => {
      const existing = await this.db.courseFollows
        .where('[userId+courseId]')
        .equals([userId, courseId])
        .first();
      if (existing) {
        return localCourseFollowToDomain(existing);
      }

      const created: CourseFollow = {
        id: generateUuid(),
        userId,
        courseId,
        createdAt: new Date().toISOString(),
      };
      await this.db.courseFollows.put(domainCourseFollowToLocal(created));
      return created;
    });
  }

  async unfollowCourse(userId: string, courseId: string): Promise<void> {
    if (this.remote !== null) {
      await this.remote.deleteCourseFollow(userId, courseId);
    }

    await this.db.courseFollows
      .where('[userId+courseId]')
      .equals([userId, courseId])
      .delete();
  }

  async create(input: CreateCourseRecordInput): Promise<Course> {
    if (this.remote !== null) {
      const created = await this.remote.createCourse(input);
      await this.db.courses.put(domainCourseToLocal(created));
      return created;
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
    await this.db.courses.put(domainCourseToLocal(created));
    return created;
  }

  async update(id: string, input: UpdateCourseRecordInput): Promise<Course> {
    if (this.remote !== null) {
      const updated = await this.remote.updateCourse(id, input);
      await this.db.courses.put(domainCourseToLocal(updated));
      return updated;
    }

    const existingRow = await this.db.courses.get(id);
    if (!existingRow) {
      throw new AppError('NOT_FOUND', 'Course not found.');
    }

    const updated: Course = {
      ...localCourseToDomain(existingRow),
      code: input.code,
      name: input.name,
      description: input.description,
      deletedAt:
        input.deletedAt !== undefined ? input.deletedAt : existingRow.deletedAt,
      updatedAt: new Date().toISOString(),
    };

    await this.db.courses.put(domainCourseToLocal(updated));
    return updated;
  }
}
