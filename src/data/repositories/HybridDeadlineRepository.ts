import { AppError } from '../../application/errors/AppError';
import type { Deadline } from '../../domain/entities';
import type {
  CreateDeadlineRecordInput,
  DeadlineRepository,
  UpdateDeadlineRecordInput,
} from '../../domain/repositories';
import type { LiteLearnDb } from '../local/LiteLearnDb';
import {
  domainDeadlineToLocal,
  localDeadlineToDomain,
} from '../mappers/contentMapper';
import type { SupabaseRemoteDataSource } from '../remote/SupabaseRemoteDataSource';
import { generateUuid } from './HybridAuthRepository';

export class HybridDeadlineRepository implements DeadlineRepository {
  constructor(
    private readonly db: LiteLearnDb,
    private readonly remote: SupabaseRemoteDataSource | null,
  ) {}

  async listByCourseIds(courseIds: readonly string[]): Promise<Deadline[]> {
    if (courseIds.length === 0) {
      return [];
    }

    const rows = await this.db.deadlines
      .where('courseId')
      .anyOf([...courseIds])
      .toArray();
    return rows
      .filter((row) => row.deletedAt === null)
      .map(localDeadlineToDomain);
  }

  async listByCourseId(courseId: string): Promise<Deadline[]> {
    const rows = await this.db.deadlines
      .where('courseId')
      .equals(courseId)
      .toArray();
    return rows
      .filter((row) => row.deletedAt === null)
      .map(localDeadlineToDomain);
  }

  async getById(id: string): Promise<Deadline | null> {
    const row = await this.db.deadlines.get(id);
    if (!row || row.deletedAt !== null) {
      return null;
    }
    return localDeadlineToDomain(row);
  }

  async create(input: CreateDeadlineRecordInput): Promise<Deadline> {
    if (this.remote !== null) {
      const created = await this.remote.createDeadline(input);
      await this.db.deadlines.put(domainDeadlineToLocal(created));
      return created;
    }

    const nowIso = new Date().toISOString();
    const created: Deadline = {
      id: generateUuid(),
      courseId: input.courseId,
      weekId: input.weekId,
      title: input.title,
      description: input.description,
      dueAt: input.dueAt,
      createdAt: nowIso,
      updatedAt: nowIso,
      deletedAt: null,
    };
    await this.db.deadlines.put(domainDeadlineToLocal(created));
    return created;
  }

  async update(
    id: string,
    input: UpdateDeadlineRecordInput,
  ): Promise<Deadline> {
    if (this.remote !== null) {
      const updated = await this.remote.updateDeadline(id, input);
      await this.db.deadlines.put(domainDeadlineToLocal(updated));
      return updated;
    }

    const existingRow = await this.db.deadlines.get(id);
    if (!existingRow) {
      throw new AppError('NOT_FOUND', 'Deadline not found.');
    }

    const updated: Deadline = {
      ...localDeadlineToDomain(existingRow),
      weekId: input.weekId,
      title: input.title,
      description: input.description,
      dueAt: input.dueAt,
      deletedAt:
        input.deletedAt !== undefined ? input.deletedAt : existingRow.deletedAt,
      updatedAt: new Date().toISOString(),
    };

    await this.db.deadlines.put(domainDeadlineToLocal(updated));
    return updated;
  }
}
