import { AppError } from '../../application/errors/AppError';
import type { Material, MaterialAttachment } from '../../domain/entities';
import type {
  CreateMaterialRecordInput,
  MaterialRepository,
  OfflineMaterialFile,
  OfflineStorageStats,
  UpdateMaterialRecordInput,
} from '../../domain/repositories';
import { hasPdfMagicHeader } from '../../domain/rules';
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
import {
  coalesceSyncQueueRow,
  getPendingBlobMaterialIds,
  resolveActiveSessionUserId,
} from './syncQueueHelpers';

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

    const activeUserId = await resolveActiveSessionUserId(this.db);

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
        await coalesceSyncQueueRow(this.db, {
          userId: activeUserId,
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

    const effectiveRemoveAttachment =
      Boolean(input.removeAttachment) && !input.file;
    const normalizedInput: UpdateMaterialRecordInput = {
      ...input,
      removeAttachment: effectiveRemoveAttachment,
    };

    if (this.remote !== null) {
      try {
        const updated = await this.remote.updateMaterial({
          id,
          classId: courseRow.classId,
          existing,
          input: normalizedInput,
        });
        const nowIso = new Date().toISOString();
        let nextIsAvailableOffline = false;

        await this.db.transaction(
          'rw',
          [this.db.materials, this.db.materialBlobs],
          async () => {
            if (updated.deletedAt !== null || effectiveRemoveAttachment) {
              await this.db.materialBlobs.delete(id);
              nextIsAvailableOffline = false;
            } else if (input.file && input.file.bytes.byteLength > 0) {
              await this.db.materialBlobs.put({
                materialId: id,
                blob: input.file.bytes,
                mimeType: 'application/pdf',
                savedAt: nowIso,
              });
              nextIsAvailableOffline = true;
            } else {
              const cached = await this.db.materialBlobs.get(id);
              nextIsAvailableOffline = Boolean(cached && updated.attachment);
            }

            await this.db.materials.put(
              domainMaterialToLocal({
                ...updated,
                isAvailableOffline: nextIsAvailableOffline,
              }),
            );
          },
        );

        const prevPath = existing.attachment?.storagePath ?? null;
        const nextPath = updated.attachment?.storagePath ?? null;
        if (
          prevPath &&
          (effectiveRemoveAttachment || Boolean(input.file)) &&
          prevPath !== nextPath
        ) {
          await this.remote.deleteMaterialPdf(prevPath);
        }

        return {
          ...updated,
          isAvailableOffline: nextIsAvailableOffline,
        };
      } catch (err) {
        if (!isNetworkFailure(err)) {
          throw err;
        }
      }
    }

    const nowIso = new Date().toISOString();
    let attachment = existing.attachment;
    let isAvailableOffline = existing.isAvailableOffline;
    if (effectiveRemoveAttachment) {
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
    if (input.deletedAt) {
      isAvailableOffline = false;
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

    const activeUserId = await resolveActiveSessionUserId(this.db);

    await this.db.transaction(
      'rw',
      [this.db.materials, this.db.materialBlobs, this.db.syncQueue],
      async () => {
        await this.db.materials.put(domainMaterialToLocal(updated));
        if (effectiveRemoveAttachment || updated.deletedAt !== null) {
          await this.db.materialBlobs.delete(id);
        }
        if (
          updated.deletedAt === null &&
          input.file &&
          input.file.bytes.byteLength > 0
        ) {
          await this.db.materialBlobs.put({
            materialId: id,
            blob: input.file.bytes,
            mimeType: 'application/pdf',
            savedAt: nowIso,
          });
        }
        await coalesceSyncQueueRow(this.db, {
          userId: activeUserId,
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
            hasPendingBlob: Boolean(
              updated.deletedAt === null &&
                input.file &&
                input.file.bytes.byteLength > 0,
            ),
            removeAttachment: effectiveRemoveAttachment,
            deletedAt: updated.deletedAt,
            updatedAt: updated.updatedAt,
          }),
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
          mimeType: 'application/pdf',
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
        const rawContentType = (response.headers.get('content-type') ?? '')
          .split(';')[0]
          ?.trim()
          .toLowerCase();
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (
          (rawContentType &&
            rawContentType !== 'application/pdf' &&
            rawContentType !== 'application/octet-stream') ||
          !hasPdfMagicHeader(bytes)
        ) {
          throw new AppError(
            'INVALID_FILE_TYPE',
            'Downloaded file is not a valid PDF document.',
          );
        }
        return {
          bytes,
          mimeType: 'application/pdf',
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
        mimeType: 'application/pdf',
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
    _mimeType: string,
  ): Promise<Material> {
    if (!hasPdfMagicHeader(bytes)) {
      throw new AppError(
        'INVALID_FILE_TYPE',
        'Offline file is not a valid PDF document.',
      );
    }

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
    };

    await this.db.transaction(
      'rw',
      [this.db.materialBlobs, this.db.materials],
      async () => {
        await this.db.materialBlobs.put({
          materialId,
          blob: bytes,
          mimeType: 'application/pdf',
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

    if (!blobRow || !materialRow || materialRow.deletedAt !== null) {
      return null;
    }

    return {
      materialId,
      fileName: materialRow.attachmentName ?? 'material.pdf',
      bytes: blobRow.blob,
      mimeType: 'application/pdf',
      savedAt: blobRow.savedAt,
    };
  }

  async removeOfflineFile(materialId: string): Promise<Material> {
    const existingRow = await this.db.materials.get(materialId);
    if (!existingRow || existingRow.deletedAt !== null) {
      throw new AppError('NOT_FOUND', 'Material not found.');
    }

    const pendingBlobIds = await getPendingBlobMaterialIds(this.db);
    if (pendingBlobIds.has(materialId)) {
      throw new AppError(
        'VALIDATION_ERROR',
        'This PDF is waiting to sync. Sync changes before removing its offline copy.',
      );
    }

    const updatedRow = {
      ...existingRow,
      isAvailableOffline: false,
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
    const pendingBlobIds = await getPendingBlobMaterialIds(this.db);
    await this.db.transaction(
      'rw',
      [this.db.materialBlobs, this.db.materials],
      async () => {
        if (pendingBlobIds.size === 0) {
          await this.db.materialBlobs.clear();
        } else {
          const allBlobs = await this.db.materialBlobs.toArray();
          const removableIds = allBlobs
            .map((row) => row.materialId)
            .filter((id) => !pendingBlobIds.has(id));
          if (removableIds.length > 0) {
            await this.db.materialBlobs.bulkDelete(removableIds);
          }
        }
        const materials = await this.db.materials.toArray();
        const updated = materials
          .filter(
            (row) => row.isAvailableOffline && !pendingBlobIds.has(row.id),
          )
          .map((row) => ({ ...row, isAvailableOffline: false }));
        if (updated.length > 0) {
          await this.db.materials.bulkPut(updated);
        }
      },
    );
  }
}
