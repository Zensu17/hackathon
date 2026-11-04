import type { Week } from '../../../domain/entities';
import type {
  CourseRepository,
  WeekRepository,
} from '../../../domain/repositories';
import type { UpdateWeekInput } from '../../dto/RepDto';
import { AppError } from '../../errors/AppError';
import { assertRepForClass, assertRepRole } from './CreateCourse';

export class UpdateWeek {
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly weekRepository: WeekRepository,
  ) {}

  async execute(input: UpdateWeekInput): Promise<Week> {
    assertRepRole(input.actor);

    const weekId = input.weekId.trim();
    if (weekId.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Week ID is required.');
    }

    const existingWeek = await this.weekRepository.getById(weekId);
    if (!existingWeek || existingWeek.deletedAt !== null) {
      throw new AppError('NOT_FOUND', 'Week not found.');
    }

    const course = await this.courseRepository.getById(existingWeek.courseId);
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

    const siblingWeeks = await this.weekRepository.listByCourseId(course.id);
    const duplicate = siblingWeeks.some(
      (week) =>
        week.id !== weekId &&
        week.deletedAt === null &&
        week.weekNumber === input.weekNumber,
    );
    if (duplicate) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Week ${input.weekNumber} already exists in this course.`,
      );
    }

    return this.weekRepository.update(weekId, {
      weekNumber: input.weekNumber,
      title,
      summary,
      deletedAt: input.deletedAt,
    });
  }
}
