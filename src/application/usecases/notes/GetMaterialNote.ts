import type { Note } from '../../../domain/entities';
import type { NoteRepository } from '../../../domain/repositories';
import type { GetMaterialNoteInput } from '../../dto';
import { AppError } from '../../errors/AppError';

export class GetMaterialNote {
  constructor(private readonly noteRepository: NoteRepository) {}

  async execute(input: GetMaterialNoteInput): Promise<Note | null> {
    const userId = input.userId.trim();
    const materialId = input.materialId.trim();
    if (userId.length === 0 || materialId.length === 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        'User ID and material ID are required to load a private note.',
      );
    }

    return this.noteRepository.getByMaterialId(userId, materialId);
  }
}
