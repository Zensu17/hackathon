import type { Deadline } from '../../../domain/entities';
import type {
  CourseRepository,
  DeadlineRepository,
  WeekRepository,
} from '../../../domain/repositories';
import type { UpdateDeadlineInput } from '../../dto/RepDto';
import { AppError } from '../../errors/AppError';
import { assertRepForClass, assertRepRole } from './CreateCourse';
import { normalizeIsoTimestamp } from './CreateDeadline';

export class UpdateDeadline {
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly weekRepository: WeekRepository,
    private readonly deadlineRepository: DeadlineRepository,
  ) {}

  async execute(input: UpdateDeadlineInput): Promise<Deadline> {
    assertRepRole(input.actor);

    const deadlineId = input.deadlineId.trim();
    if (deadlineId.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Deadline ID is required.');
    }

    const existing = await this.deadlineRepository.getById(deadlineId);
    if (!existing || existing.deletedAt !== null) {
      throw new AppError('NOT_FOUND', 'Deadline not found.');
    }

    const course = await this.courseRepository.getById(existing.courseId);
    if (!course || course.deletedAt !== null) {
      throw new AppError('NOT_FOUND', 'Course not found.');
    }

    assertRepForClass(input.actor, course.classId);

    const rawWeekId = input.weekId?.trim() ?? '';
    let resolvedWeekId: string | null = null;
    if (rawWeekId.length > 0) {
      const week = await this.weekRepository.getById(rawWeekId);
      if (!week || week.deletedAt !== null || week.courseId !== course.id) {
        throw new AppError(
          'NOT_FOUND',
          'Selected week not found in this course.',
        );
      }
      resolvedWeekId = week.id;
    }

    const title = input.title.trim();
    const description = input.description.trim();
    if (title.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Deadline title is required.');
    }

    const dueAt = normalizeIsoTimestamp(input.dueAt, 'Due date');

    return this.deadlineRepository.update(deadlineId, {
      weekId: resolvedWeekId,
      title,
      description,
      dueAt,
      deletedAt: input.deletedAt,
    });
  }
}
