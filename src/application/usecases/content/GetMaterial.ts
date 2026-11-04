import type {
  CourseRepository,
  MaterialRepository,
  WeekRepository,
} from '../../../domain/repositories';
import type {
  GetMaterialInput,
  MaterialDetailDto,
} from '../../dto/ContentDto';
import { AppError } from '../../errors/AppError';

export class GetMaterial {
  constructor(
    private readonly materialRepository: MaterialRepository,
    private readonly courseRepository: CourseRepository,
    private readonly weekRepository: WeekRepository,
  ) {}

  async execute(input: GetMaterialInput): Promise<MaterialDetailDto> {
    const materialId = input.materialId.trim();
    if (materialId.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Material ID is required.');
    }

    const material = await this.materialRepository.getById(materialId);
    if (!material || material.deletedAt !== null) {
      throw new AppError('NOT_FOUND', 'Material not found.');
    }

    const [course, week] = await Promise.all([
      this.courseRepository.getById(material.courseId),
      this.weekRepository.getById(material.weekId),
    ]);

    if (!course || course.deletedAt !== null || !week || week.deletedAt !== null) {
      throw new AppError('NOT_FOUND', 'Material parent course or week not found.');
    }

    return {
      material,
      course,
      week,
    };
  }
}
