import type { DeadlineCompletionRepository } from '../../domain/repositories/DeadlineCompletionRepository';
import type { LiteLearnDb } from '../local/LiteLearnDb';

export class DexieDeadlineCompletionRepository
  implements DeadlineCompletionRepository
{
  constructor(private readonly db: LiteLearnDb) {}

  async listCompletedDeadlineIds(userId: string): Promise<string[]> {
    const trimmedUserId = userId.trim();
    if (trimmedUserId.length === 0) {
      return [];
    }
    const rows = await this.db.deadlineCompletions
      .where('userId')
      .equals(trimmedUserId)
      .toArray();
    return rows.map((row) => row.deadlineId);
  }

  async setDeadlineCompleted(
    userId: string,
    deadlineId: string,
    completed: boolean,
  ): Promise<boolean> {
    const trimmedUserId = userId.trim();
    const trimmedDeadlineId = deadlineId.trim();
    const compositeId = `${trimmedUserId}:${trimmedDeadlineId}`;

    if (completed) {
      await this.db.deadlineCompletions.put({
        id: compositeId,
        userId: trimmedUserId,
        deadlineId: trimmedDeadlineId,
        completedAt: new Date().toISOString(),
      });
    } else {
      await this.db.deadlineCompletions.delete(compositeId);
    }

    this.db.notifyDeadlineCompletionsChanged?.();
    return completed;
  }
}
