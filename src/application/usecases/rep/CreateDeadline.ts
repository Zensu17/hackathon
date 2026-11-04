import type { Deadline } from '../../../domain/entities';
import type {
  CourseRepository,
  DeadlineRepository,
  WeekRepository,
} from '../../../domain/repositories';
import type { CreateDeadlineInput } from '../../dto/RepDto';
import { AppError } from '../../errors/AppError';
import { assertRepForClass, assertRepRole } from './CreateCourse';

export function normalizeIsoTimestamp(raw: string, fieldLabel: string): string {
  const trimmed = raw.trim();
  const parsedMs = Date.parse(trimmed);
  if (trimmed.length === 0 || Number.isNaN(parsedMs)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `${fieldLabel} must be a valid date and time.`,
    );
  }
  return new Date(parsedMs).toISOString();
}

export class CreateDeadline {
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly weekRepository: WeekRepository,
    private readonly deadlineRepository: DeadlineRepository,
  ) {}

  async execute(input: CreateDeadlineInput): Promise<Deadline> {
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

    return this.deadlineRepository.create({
      courseId: course.id,
      weekId: resolvedWeekId,
      title,
      description,
      dueAt,
    });
  }
}
