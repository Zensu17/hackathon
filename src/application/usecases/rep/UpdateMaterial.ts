import type { Material } from '../../../domain/entities';
import type {
  CourseRepository,
  MaterialRepository,
  WeekRepository,
} from '../../../domain/repositories';
import type { UpdateMaterialInput } from '../../dto/RepDto';
import { AppError } from '../../errors/AppError';
import { assertRepForClass, assertRepRole } from './CreateCourse';
import {
  normalizeExternalUrl,
  validateAttachmentUpload,
} from './CreateMaterial';

export class UpdateMaterial {
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly weekRepository: WeekRepository,
    private readonly materialRepository: MaterialRepository,
  ) {}

  async execute(input: UpdateMaterialInput): Promise<Material> {
    assertRepRole(input.actor);

    const materialId = input.materialId.trim();
    const weekId = input.weekId.trim();
    if (materialId.length === 0 || weekId.length === 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Material ID and week ID are required.',
      );
    }

    const existing = await this.materialRepository.getById(materialId);
    if (!existing || existing.deletedAt !== null) {
      throw new AppError('NOT_FOUND', 'Material not found.');
    }

    const course = await this.courseRepository.getById(existing.courseId);
    if (!course || course.deletedAt !== null) {
      throw new AppError('NOT_FOUND', 'Course not found.');
    }

    assertRepForClass(input.actor, course.classId);

    const week = await this.weekRepository.getById(weekId);
    if (!week || week.deletedAt !== null || week.courseId !== course.id) {
      throw new AppError('NOT_FOUND', 'Target week not found in this course.');
    }

    const title = input.title.trim();
    const description = input.description.trim();
    if (title.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Material title is required.');
    }

    const externalUrl = normalizeExternalUrl(input.externalUrl);
    const file = validateAttachmentUpload(input.file);

    return this.materialRepository.update(materialId, {
      weekId: week.id,
      title,
      description,
      externalUrl,
      file,
      removeAttachment: input.removeAttachment,
      deletedAt: input.deletedAt,
    });
  }
}
