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
import {
  coalesceSyncQueueRow,
  resolveActiveSessionUserId,
} from './syncQueueHelpers';

function isNetworkFailure(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
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
      try {
        const created = await this.remote.createWeek(input);
        await this.db.weeks.put(domainWeekToLocal(created));
        return created;
      } catch (err) {
        if (!isNetworkFailure(err)) {
          throw err;
        }
      }
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

    const activeUserId = await resolveActiveSessionUserId(this.db);

    await this.db.transaction(
      'rw',
      [this.db.weeks, this.db.syncQueue],
      async () => {
        await this.db.weeks.put(domainWeekToLocal(created));
        await coalesceSyncQueueRow(this.db, {
          userId: activeUserId,
          entityType: 'week',
          entityId: created.id,
          operation: 'upsert',
          payloadJson: JSON.stringify(created),
          createdAt: nowIso,
        });
      },
    );

    return created;
  }

  async update(id: string, input: UpdateWeekRecordInput): Promise<Week> {
    if (this.remote !== null) {
      try {
        const updated = await this.remote.updateWeek(id, input);
        await this.db.weeks.put(domainWeekToLocal(updated));
        return updated;
      } catch (err) {
        if (!isNetworkFailure(err)) {
          throw err;
        }
      }
    }

    const existingRow = await this.db.weeks.get(id);
    if (!existingRow) {
      throw new AppError('NOT_FOUND', 'Week not found.');
    }

    const nowIso = new Date().toISOString();
    const updated: Week = {
      ...localWeekToDomain(existingRow),
      weekNumber: input.weekNumber,
      title: input.title,
      summary: input.summary,
      deletedAt:
        input.deletedAt !== undefined ? input.deletedAt : existingRow.deletedAt,
      updatedAt: nowIso,
    };
    const activeUserId = await resolveActiveSessionUserId(this.db);

    await this.db.transaction(
      'rw',
      [this.db.weeks, this.db.syncQueue],
      async () => {
        await this.db.weeks.put(domainWeekToLocal(updated));
        await coalesceSyncQueueRow(this.db, {
          userId: activeUserId,
          entityType: 'week',
          entityId: updated.id,
          operation: updated.deletedAt ? 'delete' : 'upsert',
          payloadJson: JSON.stringify(updated),
          createdAt: nowIso,
        });
      },
    );

    return updated;
  }
}
