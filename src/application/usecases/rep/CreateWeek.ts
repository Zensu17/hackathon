import type { Week } from '../../../domain/entities';
import type {
  CourseRepository,
  WeekRepository,
} from '../../../domain/repositories';
import type { CreateWeekInput } from '../../dto/RepDto';
import { AppError } from '../../errors/AppError';
import { assertRepForClass, assertRepRole } from './CreateCourse';

export class CreateWeek {
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly weekRepository: WeekRepository,
  ) {}

  async execute(input: CreateWeekInput): Promise<Week> {
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
    const summary = input.summary.trim();

    if (!Number.isInteger(input.weekNumber) || input.weekNumber < 1) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Week number must be a positive integer.',
      );
    }

    if (title.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Week title is required.');
    }

    const existingWeeks = await this.weekRepository.listByCourseId(courseId);
    const duplicate = existingWeeks.some(
      (week) => week.deletedAt === null && week.weekNumber === input.weekNumber,
    );
    if (duplicate) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Week ${input.weekNumber} already exists in this course.`,
      );
    }

    return this.weekRepository.create({
      courseId,
      weekNumber: input.weekNumber,
      title,
      summary,
    });
  }
}
