import { AppError } from '../../application/errors/AppError';
import type { Announcement } from '../../domain/entities';
import type {
  AnnouncementRepository,
  CreateAnnouncementRecordInput,
  UpdateAnnouncementRecordInput,
} from '../../domain/repositories';
import type { LiteLearnDb } from '../local/LiteLearnDb';
import {
  domainAnnouncementToLocal,
  localAnnouncementToDomain,
} from '../mappers/contentMapper';
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

export class HybridAnnouncementRepository implements AnnouncementRepository {
  constructor(
    private readonly db: LiteLearnDb,
    private readonly remote: SupabaseRemoteDataSource | null,
  ) {}

  async listByCourseId(courseId: string): Promise<Announcement[]> {
    const rows = await this.db.announcements
      .where('courseId')
      .equals(courseId)
      .toArray();
    return rows
      .filter((row) => row.deletedAt === null)
      .map(localAnnouncementToDomain);
  }

  async listByCourseIds(courseIds: readonly string[]): Promise<Announcement[]> {
    if (courseIds.length === 0) {
      return [];
    }
    const rows = await this.db.announcements
      .where('courseId')
      .anyOf([...courseIds])
      .toArray();
    return rows
      .filter((row) => row.deletedAt === null)
      .map(localAnnouncementToDomain);
  }

  async getById(id: string): Promise<Announcement | null> {
    const row = await this.db.announcements.get(id);
    if (!row || row.deletedAt !== null) {
      return null;
    }
    return localAnnouncementToDomain(row);
  }

  async create(input: CreateAnnouncementRecordInput): Promise<Announcement> {
    if (this.remote !== null) {
      try {
        const created = await this.remote.createAnnouncement(input);
        await this.db.announcements.put(domainAnnouncementToLocal(created));
        return created;
      } catch (err) {
        if (!isNetworkFailure(err)) {
          throw err;
        }
      }
    }

    const nowIso = new Date().toISOString();
    const created: Announcement = {
      id: generateUuid(),
      courseId: input.courseId,
      title: input.title,
      body: input.body,
      postedAt: input.postedAt ?? nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
      deletedAt: null,
    };

    const activeUserId = await resolveActiveSessionUserId(this.db);

    await this.db.transaction(
      'rw',
      [this.db.announcements, this.db.syncQueue],
      async () => {
        await this.db.announcements.put(domainAnnouncementToLocal(created));
        await coalesceSyncQueueRow(this.db, {
          userId: activeUserId,
          entityType: 'announcement',
          entityId: created.id,
          operation: 'upsert',
          payloadJson: JSON.stringify(created),
          createdAt: nowIso,
        });
      },
    );

    return created;
  }

  async update(
    id: string,
    input: UpdateAnnouncementRecordInput,
  ): Promise<Announcement> {
    if (this.remote !== null) {
      try {
        const updated = await this.remote.updateAnnouncement(id, input);
        await this.db.announcements.put(domainAnnouncementToLocal(updated));
        return updated;
      } catch (err) {
        if (!isNetworkFailure(err)) {
          throw err;
        }
      }
    }

    const existingRow = await this.db.announcements.get(id);
    if (!existingRow) {
      throw new AppError('NOT_FOUND', 'Announcement not found.');
    }

    const nowIso = new Date().toISOString();
    const updated: Announcement = {
      ...localAnnouncementToDomain(existingRow),
      title: input.title,
      body: input.body,
      postedAt: input.postedAt ?? existingRow.postedAt,
      deletedAt:
        input.deletedAt !== undefined ? input.deletedAt : existingRow.deletedAt,
      updatedAt: nowIso,
    };
    const activeUserId = await resolveActiveSessionUserId(this.db);

    await this.db.transaction(
      'rw',
      [this.db.announcements, this.db.syncQueue],
      async () => {
        await this.db.announcements.put(domainAnnouncementToLocal(updated));
        await coalesceSyncQueueRow(this.db, {
          userId: activeUserId,
          entityType: 'announcement',
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
