import type { Announcement } from '../../../domain/entities';
import type {
  AnnouncementRepository,
  CourseRepository,
} from '../../../domain/repositories';
import type { UpdateAnnouncementInput } from '../../dto/RepDto';
import { AppError } from '../../errors/AppError';
import { assertRepForClass, assertRepRole } from './CreateCourse';
import { normalizeIsoTimestamp } from './CreateDeadline';

export class UpdateAnnouncement {
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly announcementRepository: AnnouncementRepository,
  ) {}

  async execute(input: UpdateAnnouncementInput): Promise<Announcement> {
    assertRepRole(input.actor);

    const announcementId = input.announcementId.trim();
    if (announcementId.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Announcement ID is required.');
    }

    const existing = await this.announcementRepository.getById(announcementId);
    if (!existing || existing.deletedAt !== null) {
      throw new AppError('NOT_FOUND', 'Announcement not found.');
    }

    const course = await this.courseRepository.getById(existing.courseId);
    if (!course || course.deletedAt !== null) {
      throw new AppError('NOT_FOUND', 'Course not found.');
    }

    assertRepForClass(input.actor, course.classId);

    const title = input.title.trim();
    const body = input.body.trim();
    if (title.length === 0 || body.length === 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Announcement title and details are required.',
      );
    }

    const postedAt = input.postedAt
      ? normalizeIsoTimestamp(input.postedAt, 'Posted date')
      : undefined;

    return this.announcementRepository.update(announcementId, {
      title,
      body,
      postedAt,
      deletedAt: input.deletedAt,
    });
  }
}
