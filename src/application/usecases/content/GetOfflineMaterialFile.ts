import type {
  MaterialRepository,
  OfflineMaterialFile,
} from '../../../domain/repositories';
import type { GetOfflineMaterialFileInput } from '../../dto';
import { AppError } from '../../errors/AppError';

export class GetOfflineMaterialFile {
  constructor(private readonly materialRepository: MaterialRepository) {}

  async execute(
    input: GetOfflineMaterialFileInput,
  ): Promise<OfflineMaterialFile | null> {
    const materialId = input.materialId.trim();
    if (materialId.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Material ID is required.');
    }

    if (!this.materialRepository.getOfflineFile) {
      return null;
    }

    return this.materialRepository.getOfflineFile(materialId);
  }
}
