import type { CourseRepository } from '../../../domain/repositories';
import type { UnfollowCourseInput } from '../../dto/CourseDto';
import { AppError } from '../../errors/AppError';

export class UnfollowCourse {
  constructor(private readonly courseRepository: CourseRepository) {}

  async execute(input: UnfollowCourseInput): Promise<void> {
    const userId = input.userId.trim();
    const courseId = input.courseId.trim();

    if (userId.length === 0 || courseId.length === 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        'User ID and course ID are required.',
      );
    }

    await this.courseRepository.unfollowCourse(userId, courseId);
  }
}
