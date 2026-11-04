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

  async getById(id: string): Promise<Announcement | null> {
    const row = await this.db.announcements.get(id);
    if (!row || row.deletedAt !== null) {
      return null;
    }
    return localAnnouncementToDomain(row);
  }

  async create(input: CreateAnnouncementRecordInput): Promise<Announcement> {
    if (this.remote !== null) {
      const created = await this.remote.createAnnouncement(input);
      await this.db.announcements.put(domainAnnouncementToLocal(created));
      return created;
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
    await this.db.announcements.put(domainAnnouncementToLocal(created));
    return created;
  }

  async update(
    id: string,
    input: UpdateAnnouncementRecordInput,
  ): Promise<Announcement> {
    if (this.remote !== null) {
      const updated = await this.remote.updateAnnouncement(id, input);
      await this.db.announcements.put(domainAnnouncementToLocal(updated));
      return updated;
    }

    const existingRow = await this.db.announcements.get(id);
    if (!existingRow) {
      throw new AppError('NOT_FOUND', 'Announcement not found.');
    }

    const updated: Announcement = {
      ...localAnnouncementToDomain(existingRow),
      title: input.title,
      body: input.body,
      postedAt: input.postedAt ?? existingRow.postedAt,
      deletedAt:
        input.deletedAt !== undefined ? input.deletedAt : existingRow.deletedAt,
      updatedAt: new Date().toISOString(),
    };

    await this.db.announcements.put(domainAnnouncementToLocal(updated));
    return updated;
  }
}
