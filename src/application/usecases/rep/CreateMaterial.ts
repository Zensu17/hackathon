import type { Material, MaterialUploadInput } from '../../../domain/entities';
import type {
  CourseRepository,
  MaterialRepository,
  WeekRepository,
} from '../../../domain/repositories';
import { validateMaterialFile } from '../../../domain/rules';
import type { CreateMaterialInput } from '../../dto/RepDto';
import { AppError } from '../../errors/AppError';
import { assertRepForClass, assertRepRole } from './CreateCourse';

export function normalizeExternalUrl(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new AppError(
      'VALIDATION_ERROR',
      'External URL must be a valid http:// or https:// address.',
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppError(
      'VALIDATION_ERROR',
      'External URL must start with http:// or https://.',
    );
  }

  if (!parsed.hostname) {
    throw new AppError(
      'VALIDATION_ERROR',
      'External URL must include a valid host.',
    );
  }

  return trimmed;
}

export function validateAttachmentUpload(
  file: MaterialUploadInput | null | undefined,
): MaterialUploadInput | null {
  if (!file) {
    return null;
  }

  const check = validateMaterialFile(file);
  if (!check.valid) {
    if (check.reason === 'file_too_large') {
      throw new AppError(
        'FILE_TOO_LARGE',
        'PDF attachment exceeds the 5 MB limit.',
      );
    }
    if (check.reason === 'invalid_mime_type') {
      throw new AppError(
        'INVALID_FILE_TYPE',
        'Only PDF files (.pdf) up to 5 MB are accepted.',
      );
    }
    throw new AppError(
      'VALIDATION_ERROR',
      'Selected PDF file cannot be empty.',
    );
  }

  return {
    ...file,
    name: file.name.trim(),
    mimeType: file.mimeType.trim() || 'application/pdf',
  };
}

export class CreateMaterial {
  constructor(
    private readonly courseRepository: CourseRepository,
    private readonly weekRepository: WeekRepository,
    private readonly materialRepository: MaterialRepository,
  ) {}

  async execute(input: CreateMaterialInput): Promise<Material> {
    assertRepRole(input.actor);

    const courseId = input.courseId.trim();
    const weekId = input.weekId.trim();
    if (courseId.length === 0 || weekId.length === 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Course ID and week ID are required.',
      );
    }

    const course = await this.courseRepository.getById(courseId);
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

    return this.materialRepository.create({
      courseId: course.id,
      weekId: week.id,
      title,
      description,
      externalUrl,
      file,
    });
  }
}
