import type { Note } from '../entities/Note';

export interface UpsertNoteRecordInput {
  userId: string;
  materialId: string;
  body: string;
}

export interface NoteRepository {
  getByMaterialId(userId: string, materialId: string): Promise<Note | null>;
  upsert(input: UpsertNoteRecordInput): Promise<Note>;
}
