import type { Material } from '../../../domain/entities';
import type { MaterialRepository } from '../../../domain/repositories';
import {
  hasPdfMagicHeader,
  MAX_MATERIAL_FILE_BYTES,
} from '../../../domain/rules';
import type { DownloadMaterialFileInput } from '../../dto';
import { AppError } from '../../errors/AppError';

export class DownloadMaterialFile {
  constructor(private readonly materialRepository: MaterialRepository) {}

  async execute(input: DownloadMaterialFileInput): Promise<Material> {
    const materialId = input.materialId.trim();
    if (materialId.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Material ID is required.');
    }

    const material = await this.materialRepository.getById(materialId);
    if (!material || material.deletedAt !== null) {
      throw new AppError('NOT_FOUND', 'Material not found.');
    }

    if (!material.attachment) {
      throw new AppError(
        'VALIDATION_ERROR',
        'This material does not have a PDF attachment.',
      );
    }

    if (material.attachment.sizeBytes > MAX_MATERIAL_FILE_BYTES) {
      throw new AppError(
        'FILE_TOO_LARGE',
        'PDF attachment exceeds the 5 MB download limit.',
      );
    }

    if (
      !this.materialRepository.downloadRemoteFile ||
      !this.materialRepository.saveOfflineFile
    ) {
      throw new AppError(
        'STORAGE_ERROR',
        'Offline PDF storage is not available in this environment.',
      );
    }

    const downloaded = await this.materialRepository.downloadRemoteFile(material);
    if (downloaded.bytes.byteLength === 0) {
      throw new AppError('STORAGE_ERROR', 'Downloaded PDF file was empty.');
    }
    if (downloaded.bytes.byteLength > MAX_MATERIAL_FILE_BYTES) {
      throw new AppError(
        'FILE_TOO_LARGE',
        'Downloaded PDF exceeds the 5 MB limit.',
      );
    }
    if (!hasPdfMagicHeader(downloaded.bytes)) {
      throw new AppError(
        'INVALID_FILE_TYPE',
        'Downloaded file is not a valid PDF document.',
      );
    }

    return this.materialRepository.saveOfflineFile(
      material.id,
      downloaded.bytes,
      'application/pdf',
    );
  }
}
