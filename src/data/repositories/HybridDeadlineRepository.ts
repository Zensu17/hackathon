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

function isNetworkFailure(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return true;
  }
  const msg =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('offline')
  );
}

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
      try {
        const created = await this.remote.createDeadline(input);
        await this.db.deadlines.put(domainDeadlineToLocal(created));
        return created;
      } catch (err) {
        if (!isNetworkFailure(err)) {
          throw err;
        }
      }
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

    await this.db.transaction(
      'rw',
      [this.db.deadlines, this.db.syncQueue],
      async () => {
        await this.db.deadlines.put(domainDeadlineToLocal(created));
        await this.db.syncQueue.put({
          id: generateUuid(),
          entityType: 'deadline',
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

  async update(
    id: string,
    input: UpdateDeadlineRecordInput,
  ): Promise<Deadline> {
    if (this.remote !== null) {
      try {
        const updated = await this.remote.updateDeadline(id, input);
        await this.db.deadlines.put(domainDeadlineToLocal(updated));
        return updated;
      } catch (err) {
        if (!isNetworkFailure(err)) {
          throw err;
        }
      }
    }

    const existingRow = await this.db.deadlines.get(id);
    if (!existingRow) {
      throw new AppError('NOT_FOUND', 'Deadline not found.');
    }

    const nowIso = new Date().toISOString();
    const updated: Deadline = {
      ...localDeadlineToDomain(existingRow),
      weekId: input.weekId,
      title: input.title,
      description: input.description,
      dueAt: input.dueAt,
      deletedAt:
        input.deletedAt !== undefined ? input.deletedAt : existingRow.deletedAt,
      updatedAt: nowIso,
    };

    await this.db.transaction(
      'rw',
      [this.db.deadlines, this.db.syncQueue],
      async () => {
        await this.db.deadlines.put(domainDeadlineToLocal(updated));
        await this.db.syncQueue.put({
          id: generateUuid(),
          entityType: 'deadline',
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
