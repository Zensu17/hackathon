import type { Course } from '../../../domain/entities';
import type { CourseRepository } from '../../../domain/repositories';
import type { UpdateCourseInput } from '../../dto/RepDto';
import { AppError } from '../../errors/AppError';
import { assertRepForClass, assertRepRole } from './CreateCourse';

export class UpdateCourse {
  constructor(private readonly courseRepository: CourseRepository) {}

  async execute(input: UpdateCourseInput): Promise<Course> {
    assertRepRole(input.actor);

    const courseId = input.courseId.trim();
    if (courseId.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Course ID is required.');
    }

    const existing = await this.courseRepository.getById(courseId);
    if (!existing || existing.deletedAt !== null) {
      throw new AppError('NOT_FOUND', 'Course not found.');
    }

    assertRepForClass(input.actor, existing.classId);

    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    const description = input.description.trim();

    if (code.length === 0 || name.length === 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Course code and title are required.',
      );
    }

    return this.courseRepository.update(courseId, {
      code,
      name,
      description,
      deletedAt: input.deletedAt,
    });
  }
}
