import type { Course, User } from '../../../domain/entities';
import type { CourseRepository } from '../../../domain/repositories';
import type { CreateCourseInput } from '../../dto/RepDto';
import { AppError } from '../../errors/AppError';

export function assertRepRole(actor: User): string {
  if (actor.deletedAt !== null || actor.role !== 'rep' || !actor.classId) {
    throw new AppError(
      'FORBIDDEN_ROLE',
      'Only class representatives can modify class content.',
    );
  }
  return actor.classId;
}

export function assertRepForClass(actor: User, targetClassId: string): void {
  const actorClassId = assertRepRole(actor);
  if (actorClassId !== targetClassId) {
    throw new AppError(
      'FORBIDDEN_ROLE',
      'Actor is not a representative of this class.',
    );
  }
}

export class CreateCourse {
  constructor(private readonly courseRepository: CourseRepository) {}

  async execute(input: CreateCourseInput): Promise<Course> {
    const classId = input.classId.trim();
    if (classId.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Class ID is required.');
    }

    assertRepForClass(input.actor, classId);

    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    const description = input.description.trim();

    if (code.length === 0 || name.length === 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Course code and title are required.',
      );
    }

    const created = await this.courseRepository.create({
      classId,
      code,
      name,
      description,
    });

    await this.courseRepository.followCourse(input.actor.id, created.id);
    return created;
  }
}
