import type { Material, MaterialUploadInput } from '../entities/Material';

export interface CreateMaterialRecordInput {
  courseId: string;
  weekId: string;
  title: string;
  description: string;
  externalUrl: string | null;
  file?: MaterialUploadInput | null;
}

export interface UpdateMaterialRecordInput {
  weekId: string;
  title: string;
  description: string;
  externalUrl: string | null;
  file?: MaterialUploadInput | null;
  removeAttachment?: boolean;
  deletedAt?: string | null;
}

export interface OfflineMaterialFile {
  materialId: string;
  fileName: string;
  bytes: Uint8Array;
  mimeType: string;
  savedAt: string;
}

export interface OfflineStorageStats {
  fileCount: number;
  totalBytes: number;
}

export interface MaterialRepository {
  listByCourseId(courseId: string): Promise<Material[]>;
  listByCourseIds?(courseIds: readonly string[]): Promise<Material[]>;
  listByWeekId(weekId: string): Promise<Material[]>;
  getById(id: string): Promise<Material | null>;
  create(input: CreateMaterialRecordInput): Promise<Material>;
  update(id: string, input: UpdateMaterialRecordInput): Promise<Material>;
  downloadRemoteFile?(material: Material): Promise<{ bytes: Uint8Array; mimeType: string }>;
  saveOfflineFile?(
    materialId: string,
    bytes: Uint8Array,
    mimeType: string,
  ): Promise<Material>;
  getOfflineFile?(materialId: string): Promise<OfflineMaterialFile | null>;
  removeOfflineFile?(materialId: string): Promise<Material>;
  getOfflineStorageStats?(): Promise<OfflineStorageStats>;
  clearAllOfflineFiles?(): Promise<void>;
}
