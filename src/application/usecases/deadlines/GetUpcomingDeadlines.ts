import type { Course } from '../../../domain/entities';
import type {
  CourseRepository,
  DeadlineRepository,
} from '../../../domain/repositories';
import {
  isDueSoon,
  isOverdue,
  sortDeadlines,
} from '../../../domain/rules';
import type {
  GetUpcomingDeadlinesInput,
  UpcomingDeadlineDto,
  UpcomingDeadlinesResultDto,
} from '../../dto/DeadlineDto';
import { AppError } from '../../errors/AppError';

export class GetUpcomingDeadlines {
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly deadlineRepository: DeadlineRepository,
    private readonly nowProvider: () => string = () => new Date().toISOString(),
  ) {}

  async execute(
    input: GetUpcomingDeadlinesInput,
  ): Promise<UpcomingDeadlinesResultDto> {
    const userId = input.userId.trim();
    if (userId.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'User ID is required.');
    }

    const followedCourseIds =
      await this.courseRepository.listFollowedCourseIds(userId);
    if (followedCourseIds.length === 0) {
      return {
        followedCourseCount: 0,
        items: [],
      };
    }

    const uniqueIds = Array.from(new Set(followedCourseIds));
    const resolvedCourses = await Promise.all(
      uniqueIds.map((id) => this.courseRepository.getById(id)),
    );

    const activeCourseById = new Map<string, Course>();
    for (const course of resolvedCourses) {
      if (course && course.deletedAt === null) {
        activeCourseById.set(course.id, course);
      }
    }

    if (activeCourseById.size === 0) {
      return {
        followedCourseCount: 0,
        items: [],
      };
    }

    const activeIds = Array.from(activeCourseById.keys());
    const rawDeadlines = await this.deadlineRepository.listByCourseIds(activeIds);
    const activeDeadlines = rawDeadlines.filter(
      (deadline) =>
        deadline.deletedAt === null && activeCourseById.has(deadline.courseId),
    );

    const nowIso = this.nowProvider();
    const items: UpcomingDeadlineDto[] = sortDeadlines(activeDeadlines).map(
      (deadline) => {
        const course = activeCourseById.get(deadline.courseId);
        return {
          ...deadline,
          courseCode: course?.code ?? '',
          courseName: course?.name ?? '',
          isOverdue: isOverdue(deadline.dueAt, nowIso),
          isDueSoon: isDueSoon(deadline.dueAt, nowIso),
        };
      },
    );

    return {
      followedCourseCount: activeCourseById.size,
      items,
    };
  }
}
