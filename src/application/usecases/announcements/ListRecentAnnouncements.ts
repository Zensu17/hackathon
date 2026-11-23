import type { Announcement, Course } from '../../../domain/entities';
import type {
  AnnouncementRepository,
  CourseRepository,
} from '../../../domain/repositories';
import type {
  ListRecentAnnouncementsInput,
  RecentAnnouncementDto,
} from '../../dto';
import { AppError } from '../../errors/AppError';

export class ListRecentAnnouncements {
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly announcementRepository: AnnouncementRepository,
  ) {}

  async execute(
    input: ListRecentAnnouncementsInput,
  ): Promise<RecentAnnouncementDto[]> {
    const userId = input.userId.trim();
    if (userId.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'User ID is required.');
    }

    const limit = input.limit && input.limit > 0 ? Math.floor(input.limit) : 5;
    const followedCourseIds =
      await this.courseRepository.listFollowedCourseIds(userId);

    if (followedCourseIds.length === 0) {
      return [];
    }

    const courseEntries = await Promise.all(
      followedCourseIds.map((courseId) => this.courseRepository.getById(courseId)),
    );
    const courseById = new Map<string, Course>();
    for (const course of courseEntries) {
      if (course && course.deletedAt === null) {
        courseById.set(course.id, course);
      }
    }

    const activeCourseIds = Array.from(courseById.keys());
    if (activeCourseIds.length === 0) {
      return [];
    }

    let rawAnnouncements: Announcement[];
    if (this.announcementRepository.listByCourseIds) {
      rawAnnouncements =
        await this.announcementRepository.listByCourseIds(activeCourseIds);
    } else {
      const lists = await Promise.all(
        activeCourseIds.map((courseId) =>
          this.announcementRepository.listByCourseId(courseId),
        ),
      );
      rawAnnouncements = lists.flat();
    }

    return rawAnnouncements
      .filter((item) => item.deletedAt === null && courseById.has(item.courseId))
      .sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt))
      .slice(0, limit)
      .map((announcement) => {
        const course = courseById.get(announcement.courseId)!;
        return {
          announcement,
          courseCode: course.code,
          courseName: course.name,
        };
      });
  }
}
