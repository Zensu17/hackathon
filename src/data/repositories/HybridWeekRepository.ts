import { AppError } from '../../application/errors/AppError';
import type { Week } from '../../domain/entities';
import type {
  CreateWeekRecordInput,
  UpdateWeekRecordInput,
  WeekRepository,
} from '../../domain/repositories';
import type { LiteLearnDb } from '../local/LiteLearnDb';
import { domainWeekToLocal, localWeekToDomain } from '../mappers/contentMapper';
import type { SupabaseRemoteDataSource } from '../remote/SupabaseRemoteDataSource';
import { generateUuid } from './HybridAuthRepository';

export class HybridWeekRepository implements WeekRepository {
  constructor(
    private readonly db: LiteLearnDb,
    private readonly remote: SupabaseRemoteDataSource | null,
  ) {}

  async listByCourseId(courseId: string): Promise<Week[]> {
    const rows = await this.db.weeks
      .where('courseId')
      .equals(courseId)
      .toArray();
    return rows.filter((row) => row.deletedAt === null).map(localWeekToDomain);
  }

  async getById(id: string): Promise<Week | null> {
    const row = await this.db.weeks.get(id);
    if (!row || row.deletedAt !== null) {
      return null;
    }
    return localWeekToDomain(row);
  }

  async create(input: CreateWeekRecordInput): Promise<Week> {
    if (this.remote !== null) {
      const created = await this.remote.createWeek(input);
      await this.db.weeks.put(domainWeekToLocal(created));
      return created;
    }

    const nowIso = new Date().toISOString();
    const created: Week = {
      id: generateUuid(),
      courseId: input.courseId,
      weekNumber: input.weekNumber,
      title: input.title,
      summary: input.summary,
      createdAt: nowIso,
      updatedAt: nowIso,
      deletedAt: null,
    };
    await this.db.weeks.put(domainWeekToLocal(created));
    return created;
  }

  async update(id: string, input: UpdateWeekRecordInput): Promise<Week> {
    if (this.remote !== null) {
      const updated = await this.remote.updateWeek(id, input);
      await this.db.weeks.put(domainWeekToLocal(updated));
      return updated;
    }

    const existingRow = await this.db.weeks.get(id);
    if (!existingRow) {
      throw new AppError('NOT_FOUND', 'Week not found.');
    }

    const updated: Week = {
      ...localWeekToDomain(existingRow),
      weekNumber: input.weekNumber,
      title: input.title,
      summary: input.summary,
      deletedAt:
        input.deletedAt !== undefined ? input.deletedAt : existingRow.deletedAt,
      updatedAt: new Date().toISOString(),
    };

    await this.db.weeks.put(domainWeekToLocal(updated));
    return updated;
  }
}
