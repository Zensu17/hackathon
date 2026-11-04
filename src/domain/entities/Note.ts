export interface Note {
  id: string;
  userId: string;
  materialId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
