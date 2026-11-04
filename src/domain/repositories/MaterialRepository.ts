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

export interface MaterialRepository {
  listByCourseId(courseId: string): Promise<Material[]>;
  listByWeekId(weekId: string): Promise<Material[]>;
  getById(id: string): Promise<Material | null>;
  create(input: CreateMaterialRecordInput): Promise<Material>;
  update(id: string, input: UpdateMaterialRecordInput): Promise<Material>;
}
