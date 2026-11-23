import type { Material } from '../../../domain/entities';
import type { MaterialRepository } from '../../../domain/repositories';
import type { RemoveOfflineMaterialFileInput } from '../../dto';
import { AppError } from '../../errors/AppError';

export class RemoveOfflineMaterialFile {
  constructor(private readonly materialRepository: MaterialRepository) {}

  async execute(input: RemoveOfflineMaterialFileInput): Promise<Material> {
    const materialId = input.materialId.trim();
    if (materialId.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Material ID is required.');
    }

    if (!this.materialRepository.removeOfflineFile) {
      throw new AppError(
        'STORAGE_ERROR',
        'Offline PDF storage is not available in this environment.',
      );
    }

    return this.materialRepository.removeOfflineFile(materialId);
  }
}
