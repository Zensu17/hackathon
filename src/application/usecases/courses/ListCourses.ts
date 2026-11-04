import type { CourseRepository } from '../../../domain/repositories';
import type {
  CourseListItemDto,
  ListCoursesInput,
} from '../../dto/CourseDto';
import { AppError } from '../../errors/AppError';

export class ListCourses {
  constructor(private readonly courseRepository: CourseRepository) {}

  async execute(input: ListCoursesInput): Promise<CourseListItemDto[]> {
    const classId = input.classId.trim();
    const userId = input.userId.trim();

    if (classId.length === 0 || userId.length === 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Class ID and user ID are required.',
      );
    }

    const [courses, followedIds] = await Promise.all([
      this.courseRepository.listByClassId(classId),
      this.courseRepository.listFollowedCourseIds(userId),
    ]);

    const followedSet = new Set(followedIds);

    return courses
      .filter((course) => course.deletedAt === null)
      .sort((a, b) => {
        const codeDiff = a.code.localeCompare(b.code);
        return codeDiff !== 0 ? codeDiff : a.name.localeCompare(b.name);
      })
      .map((course) => ({
        ...course,
        isFollowed: followedSet.has(course.id),
      }));
  }
}
