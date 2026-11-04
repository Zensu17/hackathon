import type { Note } from '../../domain/entities';
import type {
  NoteRepository,
  UpsertNoteRecordInput,
} from '../../domain/repositories';
import type { LiteLearnDb } from '../local/LiteLearnDb';
import { domainNoteToLocal, localNoteToDomain } from '../mappers/contentMapper';
import { generateUuid } from './HybridAuthRepository';

export class DexieNoteRepository implements NoteRepository {
  constructor(private readonly db: LiteLearnDb) {}

  async getByMaterialId(
    userId: string,
    materialId: string,
  ): Promise<Note | null> {
    const row = await this.db.notes
      .where('[userId+materialId]')
      .equals([userId, materialId])
      .first();

    if (!row || row.deletedAt !== null) {
      return null;
    }
    return localNoteToDomain(row);
  }

  async upsert(input: UpsertNoteRecordInput): Promise<Note> {
    return this.db.transaction('rw', this.db.notes, async () => {
      const existing = await this.db.notes
        .where('[userId+materialId]')
        .equals([input.userId, input.materialId])
        .first();
      const nowIso = new Date().toISOString();

      if (existing) {
        const updated: Note = {
          ...localNoteToDomain(existing),
          body: input.body,
          deletedAt: null,
          updatedAt: nowIso,
        };
        await this.db.notes.put(domainNoteToLocal(updated));
        return updated;
      }

      const created: Note = {
        id: generateUuid(),
        userId: input.userId,
        materialId: input.materialId,
        body: input.body,
        createdAt: nowIso,
        updatedAt: nowIso,
        deletedAt: null,
      };
      await this.db.notes.put(domainNoteToLocal(created));
      return created;
    });
  }
}
