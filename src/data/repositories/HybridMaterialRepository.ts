import { AppError } from '../../application/errors/AppError';
import type { Material, MaterialAttachment } from '../../domain/entities';
import type {
  CreateMaterialRecordInput,
  MaterialRepository,
  OfflineMaterialFile,
  OfflineStorageStats,
  UpdateMaterialRecordInput,
} from '../../domain/repositories';
import type { LiteLearnDb } from '../local/LiteLearnDb';
import { buildSampleStudyPdf } from '../local/samplePdf';
import {
  domainMaterialToLocal,
  localMaterialToDomain,
} from '../mappers/contentMapper';
import {
  sanitizeStorageFileName,
  type SupabaseRemoteDataSource,
} from '../remote/SupabaseRemoteDataSource';
import { generateUuid } from './HybridAuthRepository';

function isNetworkFailure(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }
  const msg =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('offline')
  );
}

export class HybridMaterialRepository implements MaterialRepository {
  constructor(
    private readonly db: LiteLearnDb,
    private readonly remote: SupabaseRemoteDataSource | null,
  ) {}

  async listByCourseId(courseId: string): Promise<Material[]> {
    const rows = await this.db.materials
      .where('courseId')
      .equals(courseId)
      .toArray();
    return rows
      .filter((row) => row.deletedAt === null)
      .map(localMaterialToDomain);
  }

  async listByCourseIds(courseIds: readonly string[]): Promise<Material[]> {
    if (courseIds.length === 0) {
      return [];
    }
    const rows = await this.db.materials
      .where('courseId')
      .anyOf([...courseIds])
      .toArray();
    return rows
      .filter((row) => row.deletedAt === null)
      .map(localMaterialToDomain);
  }

  async listByWeekId(weekId: string): Promise<Material[]> {
    const rows = await this.db.materials
      .where('weekId')
      .equals(weekId)
      .toArray();
    return rows
      .filter((row) => row.deletedAt === null)
      .map(localMaterialToDomain);
  }

  async getById(id: string): Promise<Material | null> {
    const row = await this.db.materials.get(id);
    if (!row || row.deletedAt !== null) {
      return null;
    }
    return localMaterialToDomain(row);
  }

  async create(input: CreateMaterialRecordInput): Promise<Material> {
    const courseRow = await this.db.courses.get(input.courseId);
    if (!courseRow || courseRow.deletedAt !== null) {
      throw new AppError('NOT_FOUND', 'Course not found.');
    }

    const materialId = generateUuid();

    if (this.remote !== null) {
      try {
        const created = await this.remote.createMaterial({
          id: materialId,
          classId: courseRow.classId,
          input,
        });
        await this.db.materials.put(domainMaterialToLocal(created));
        return created;
      } catch (err) {
        if (!isNetworkFailure(err)) {
          throw err;
        }
      }
    }

    const nowIso = new Date().toISOString();
    let attachment: MaterialAttachment | null = null;
    let isAvailableOffline = false;
    if (input.file) {
      const safeName = sanitizeStorageFileName(input.file.name);
      attachment = {
        name: safeName,
        sizeBytes: input.file.sizeBytes,
        mimeType: 'application/pdf',
        storagePath: `${courseRow.classId}/${courseRow.id}/${materialId}/${safeName}`,
        remoteUrl: null,
      };
      isAvailableOffline = input.file.bytes.byteLength > 0;
    }

    const created: Material = {
      id: materialId,
      courseId: input.courseId,
      weekId: input.weekId,
      title: input.title,
      description: input.description,
      externalUrl: input.externalUrl,
      attachment,
      isAvailableOffline,
      createdAt: nowIso,
      updatedAt: nowIso,
      deletedAt: null,
    };

    await this.db.transaction(
      'rw',
      [this.db.materials, this.db.materialBlobs, this.db.syncQueue],
      async () => {
        await this.db.materials.put(domainMaterialToLocal(created));
        if (input.file && input.file.bytes.byteLength > 0) {
          await this.db.materialBlobs.put({
            materialId: created.id,
            blob: input.file.bytes,
            mimeType: 'application/pdf',
            savedAt: nowIso,
          });
        }
        await this.db.syncQueue.put({
          id: generateUuid(),
          entityType: 'material',
          entityId: created.id,
          operation: 'upsert',
          payloadJson: JSON.stringify({
            id: created.id,
            classId: courseRow.classId,
            courseId: created.courseId,
            weekId: created.weekId,
            title: created.title,
            description: created.description,
            externalUrl: created.externalUrl,
            attachmentName: created.attachment?.name ?? null,
            attachmentSizeBytes: created.attachment?.sizeBytes ?? null,
            attachmentMimeType: created.attachment?.mimeType ?? null,
            attachmentStoragePath: created.attachment?.storagePath ?? null,
            hasPendingBlob: Boolean(input.file && input.file.bytes.byteLength > 0),
            updatedAt: created.updatedAt,
          }),
          attempts: 0,
          lastError: null,
          nextRetryAt: null,
          createdAt: nowIso,
        });
      },
    );

    return created;
  }

  async update(id: string, input: UpdateMaterialRecordInput): Promise<Material> {
    const existingRow = await this.db.materials.get(id);
    if (!existingRow) {
      throw new AppError('NOT_FOUND', 'Material not found.');
    }

    const existing = localMaterialToDomain(existingRow);
    const courseRow = await this.db.courses.get(existing.courseId);
    if (!courseRow || courseRow.deletedAt !== null) {
      throw new AppError('NOT_FOUND', 'Course not found.');
    }

    if (this.remote !== null) {
      try {
        const updated = await this.remote.updateMaterial({
          id,
          classId: courseRow.classId,
          existing,
          input,
        });
        await this.db.materials.put(domainMaterialToLocal(updated));
        return updated;
      } catch (err) {
        if (!isNetworkFailure(err)) {
          throw err;
        }
      }
    }

    const nowIso = new Date().toISOString();
    let attachment = existing.attachment;
    let isAvailableOffline = existing.isAvailableOffline;
    if (input.removeAttachment) {
      attachment = null;
      isAvailableOffline = false;
    }
    if (input.file) {
      const safeName = sanitizeStorageFileName(input.file.name);
      attachment = {
        name: safeName,
        sizeBytes: input.file.sizeBytes,
        mimeType: 'application/pdf',
        storagePath: `${courseRow.classId}/${courseRow.id}/${id}/${safeName}`,
        remoteUrl: null,
      };
      isAvailableOffline = input.file.bytes.byteLength > 0;
    }

    const updated: Material = {
      ...existing,
      weekId: input.weekId,
      title: input.title,
      description: input.description,
      externalUrl: input.externalUrl,
      attachment,
      isAvailableOffline,
      deletedAt:
        input.deletedAt !== undefined ? input.deletedAt : existing.deletedAt,
      updatedAt: nowIso,
    };

    await this.db.transaction(
      'rw',
      [this.db.materials, this.db.materialBlobs, this.db.syncQueue],
      async () => {
        await this.db.materials.put(domainMaterialToLocal(updated));
        if (input.removeAttachment) {
          await this.db.materialBlobs.delete(id);
        }
        if (input.file && input.file.bytes.byteLength > 0) {
          await this.db.materialBlobs.put({
            materialId: id,
            blob: input.file.bytes,
            mimeType: 'application/pdf',
            savedAt: nowIso,
          });
        }
        await this.db.syncQueue.put({
          id: generateUuid(),
          entityType: 'material',
          entityId: updated.id,
          operation: updated.deletedAt ? 'delete' : 'upsert',
          payloadJson: JSON.stringify({
            id: updated.id,
            classId: courseRow.classId,
            courseId: updated.courseId,
            weekId: updated.weekId,
            title: updated.title,
            description: updated.description,
            externalUrl: updated.externalUrl,
            attachmentName: updated.attachment?.name ?? null,
            attachmentSizeBytes: updated.attachment?.sizeBytes ?? null,
            attachmentMimeType: updated.attachment?.mimeType ?? null,
            attachmentStoragePath: updated.attachment?.storagePath ?? null,
            previousStoragePath: existing.attachment?.storagePath ?? null,
            hasPendingBlob: Boolean(input.file && input.file.bytes.byteLength > 0),
            removeAttachment: Boolean(input.removeAttachment),
            deletedAt: updated.deletedAt,
            updatedAt: updated.updatedAt,
          }),
          attempts: 0,
          lastError: null,
          nextRetryAt: null,
          createdAt: nowIso,
        });
      },
    );

    return updated;
  }

  async downloadRemoteFile(
    material: Material,
  ): Promise<{ bytes: Uint8Array; mimeType: string }> {
    if (!material.attachment) {
      throw new AppError(
        'VALIDATION_ERROR',
        'This material does not have a PDF attachment.',
      );
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const existingBlob = await this.db.materialBlobs.get(material.id);
      if (existingBlob) {
        return {
          bytes: existingBlob.blob,
          mimeType: existingBlob.mimeType,
        };
      }
      throw new AppError(
        'STORAGE_ERROR',
        'You are offline. Connect briefly to download this PDF to your device.',
      );
    }

    if (this.remote !== null) {
      // Always mint a fresh signed URL when storagePath exists to avoid 1-hour expiry errors.
      const signedUrl = material.attachment.storagePath
        ? await this.remote.getSignedMaterialUrl(material.attachment.storagePath)
        : material.attachment.remoteUrl;
      if (!signedUrl) {
        throw new AppError(
          'STORAGE_ERROR',
          'Could not generate a download link for this PDF.',
        );
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(signedUrl, { signal: controller.signal });
        if (!response.ok) {
          throw new AppError(
            'STORAGE_ERROR',
            `PDF download failed with HTTP ${response.status}.`,
          );
        }
        const buffer = await response.arrayBuffer();
        return {
          bytes: new Uint8Array(buffer),
          mimeType: response.headers.get('content-type') || 'application/pdf',
        };
      } catch (err) {
        if (err instanceof AppError) {
          throw err;
        }
        throw new AppError(
          'STORAGE_ERROR',
          'PDF download interrupted. Check your connection and try again.',
        );
      } finally {
        clearTimeout(timeoutId);
      }
    }

    const existingBlob = await this.db.materialBlobs.get(material.id);
    if (existingBlob) {
      return {
        bytes: existingBlob.blob,
        mimeType: existingBlob.mimeType,
      };
    }

    const course = await this.db.courses.get(material.courseId);
    const bytes = buildSampleStudyPdf({
      title: material.title,
      courseLabel: course ? `${course.code} - ${course.name}` : material.courseId,
      fileName: material.attachment.name,
      summary: material.description,
    });

    return {
      bytes,
      mimeType: 'application/pdf',
    };
  }

  async saveOfflineFile(
    materialId: string,
    bytes: Uint8Array,
    mimeType: string,
  ): Promise<Material> {
    const existingRow = await this.db.materials.get(materialId);
    if (!existingRow || existingRow.deletedAt !== null) {
      throw new AppError('NOT_FOUND', 'Material not found.');
    }

    const nowIso = new Date().toISOString();
    const updatedRow = {
      ...existingRow,
      attachmentSizeBytes:
        existingRow.attachmentSizeBytes ?? bytes.byteLength,
      isAvailableOffline: true,
      updatedAt: nowIso,
    };

    await this.db.transaction(
      'rw',
      [this.db.materialBlobs, this.db.materials],
      async () => {
        await this.db.materialBlobs.put({
          materialId,
          blob: bytes,
          mimeType: mimeType || 'application/pdf',
          savedAt: nowIso,
        });
        await this.db.materials.put(updatedRow);
      },
    );

    return localMaterialToDomain(updatedRow);
  }

  async getOfflineFile(materialId: string): Promise<OfflineMaterialFile | null> {
    const [blobRow, materialRow] = await Promise.all([
      this.db.materialBlobs.get(materialId),
      this.db.materials.get(materialId),
    ]);

    if (!blobRow) {
      return null;
    }

    return {
      materialId,
      fileName: materialRow?.attachmentName ?? 'material.pdf',
      bytes: blobRow.blob,
      mimeType: blobRow.mimeType || 'application/pdf',
      savedAt: blobRow.savedAt,
    };
  }

  async removeOfflineFile(materialId: string): Promise<Material> {
    const existingRow = await this.db.materials.get(materialId);
    if (!existingRow || existingRow.deletedAt !== null) {
      throw new AppError('NOT_FOUND', 'Material not found.');
    }

    const updatedRow = {
      ...existingRow,
      isAvailableOffline: false,
      updatedAt: new Date().toISOString(),
    };

    await this.db.transaction(
      'rw',
      [this.db.materialBlobs, this.db.materials],
      async () => {
        await this.db.materialBlobs.delete(materialId);
        await this.db.materials.put(updatedRow);
      },
    );

    return localMaterialToDomain(updatedRow);
  }

  async getOfflineStorageStats(): Promise<OfflineStorageStats> {
    const blobs = await this.db.materialBlobs.toArray();
    let totalBytes = 0;
    for (const item of blobs) {
      totalBytes += item.blob.byteLength;
    }
    return {
      fileCount: blobs.length,
      totalBytes,
    };
  }

  async clearAllOfflineFiles(): Promise<void> {
    await this.db.transaction(
      'rw',
      [this.db.materialBlobs, this.db.materials],
      async () => {
        await this.db.materialBlobs.clear();
        const materials = await this.db.materials.toArray();
        const updated = materials
          .filter((row) => row.isAvailableOffline)
          .map((row) => ({ ...row, isAvailableOffline: false }));
        if (updated.length > 0) {
          await this.db.materials.bulkPut(updated);
        }
      },
    );
  }
}
