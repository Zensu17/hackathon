import type { Announcement } from '../../../domain/entities';
import type { AnnouncementRepository } from '../../../domain/repositories';
import type { ListAnnouncementsInput } from '../../dto/ContentDto';
import { AppError } from '../../errors/AppError';

export class ListAnnouncements {
  constructor(private readonly announcementRepository: AnnouncementRepository) {}

  async execute(input: ListAnnouncementsInput): Promise<Announcement[]> {
    const courseId = input.courseId.trim();
    if (courseId.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Course ID is required.');
    }

    const rows = await this.announcementRepository.listByCourseId(courseId);
    return rows
      .filter((row) => row.deletedAt === null)
      .sort((a, b) => {
        const aMs = Date.parse(a.postedAt);
        const bMs = Date.parse(b.postedAt);
        const aInvalid = Number.isNaN(aMs);
        const bInvalid = Number.isNaN(bMs);

        if (aInvalid && bInvalid) {
          return a.id.localeCompare(b.id);
        }
        if (aInvalid) {
          return 1;
        }
        if (bInvalid) {
          return -1;
        }
        if (aMs !== bMs) {
          return bMs - aMs;
        }
        return a.id.localeCompare(b.id);
      });
  }
}
