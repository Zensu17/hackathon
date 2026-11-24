import type { Note } from '../../../domain/entities';
import type {
  NoteRepository,
  SyncQueueRepository,
} from '../../../domain/repositories';
import type { SaveMaterialNoteInput } from '../../dto';
import { AppError } from '../../errors/AppError';

export class SaveMaterialNote {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly syncQueueRepository: SyncQueueRepository,
  ) {}

  async execute(input: SaveMaterialNoteInput): Promise<Note> {
    const userId = input.userId.trim();
    const materialId = input.materialId.trim();

    if (userId.length === 0 || materialId.length === 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        'User ID and material ID are required to save a private note.',
      );
    }

    const saved = await this.noteRepository.upsert({
      userId,
      materialId,
      body: input.body,
    });

    await this.syncQueueRepository.enqueue({
      userId,
      entityType: 'note',
      entityId: saved.id,
      operation: 'upsert',
      payloadJson: JSON.stringify(saved),
    });

    return saved;
  }
}
