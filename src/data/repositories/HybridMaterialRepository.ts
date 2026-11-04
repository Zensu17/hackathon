import { AppError } from '../../application/errors/AppError';
import type { Material, MaterialAttachment } from '../../domain/entities';
import type {
  CreateMaterialRecordInput,
  MaterialRepository,
  UpdateMaterialRecordInput,
} from '../../domain/repositories';
import type { LiteLearnDb } from '../local/LiteLearnDb';
import {
  domainMaterialToLocal,
  localMaterialToDomain,
} from '../mappers/contentMapper';
import {
  sanitizeStorageFileName,
  type SupabaseRemoteDataSource,
} from '../remote/SupabaseRemoteDataSource';
import { generateUuid } from './HybridAuthRepository';

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
      const created = await this.remote.createMaterial({
        id: materialId,
        classId: courseRow.classId,
        input,
      });
      await this.db.materials.put(domainMaterialToLocal(created));
      return created;
    }

    const nowIso = new Date().toISOString();
    let attachment: MaterialAttachment | null = null;
    if (input.file) {
      const safeName = sanitizeStorageFileName(input.file.name);
      attachment = {
        name: safeName,
        sizeBytes: input.file.sizeBytes,
        mimeType: 'application/pdf',
        storagePath: `${courseRow.classId}/${courseRow.id}/${materialId}/${safeName}`,
        remoteUrl: null,
      };
    }

    const created: Material = {
      id: materialId,
      courseId: input.courseId,
      weekId: input.weekId,
      title: input.title,
      description: input.description,
      externalUrl: input.externalUrl,
      attachment,
      isAvailableOffline: false,
      createdAt: nowIso,
      updatedAt: nowIso,
      deletedAt: null,
    };

    await this.db.materials.put(domainMaterialToLocal(created));
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
      const updated = await this.remote.updateMaterial({
        id,
        classId: courseRow.classId,
        existing,
        input,
      });
      await this.db.materials.put(domainMaterialToLocal(updated));
      return updated;
    }

    let attachment = existing.attachment;
    if (input.removeAttachment) {
      attachment = null;
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
    }

    const updated: Material = {
      ...existing,
      weekId: input.weekId,
      title: input.title,
      description: input.description,
      externalUrl: input.externalUrl,
      attachment,
      deletedAt:
        input.deletedAt !== undefined ? input.deletedAt : existing.deletedAt,
      updatedAt: new Date().toISOString(),
    };

    await this.db.materials.put(domainMaterialToLocal(updated));
    return updated;
  }
}
