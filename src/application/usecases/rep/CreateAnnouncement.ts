import type { Announcement } from '../../../domain/entities';
import type {
  AnnouncementRepository,
  CourseRepository,
} from '../../../domain/repositories';
import type { CreateAnnouncementInput } from '../../dto/RepDto';
import { AppError } from '../../errors/AppError';
import { assertRepForClass, assertRepRole } from './CreateCourse';
import { normalizeIsoTimestamp } from './CreateDeadline';

export class CreateAnnouncement {
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly announcementRepository: AnnouncementRepository,
  ) {}

  async execute(input: CreateAnnouncementInput): Promise<Announcement> {
    assertRepRole(input.actor);

    const courseId = input.courseId.trim();
    if (courseId.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Course ID is required.');
    }

    const course = await this.courseRepository.getById(courseId);
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

    return this.announcementRepository.create({
      courseId: course.id,
      title,
      body,
      postedAt,
    });
  }
}
