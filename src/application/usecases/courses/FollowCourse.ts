import type { CourseFollow } from '../../../domain/entities';
import type { CourseRepository } from '../../../domain/repositories';
import type { FollowCourseInput } from '../../dto/CourseDto';
import { AppError } from '../../errors/AppError';

export class FollowCourse {
  constructor(private readonly courseRepository: CourseRepository) {}

  async execute(input: FollowCourseInput): Promise<CourseFollow> {
    const userId = input.userId.trim();
    const courseId = input.courseId.trim();

    if (userId.length === 0 || courseId.length === 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        'User ID and course ID are required.',
      );
    }

    const course = await this.courseRepository.getById(courseId);
    if (!course || course.deletedAt !== null) {
      throw new AppError('NOT_FOUND', 'Course not found.');
    }

    return this.courseRepository.followCourse(userId, courseId);
  }
}
