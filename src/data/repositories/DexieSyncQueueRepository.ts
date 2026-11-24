import type { SyncQueueItem } from '../../domain/entities';
import type {
  EnqueueSyncItemInput,
  SyncQueueRepository,
} from '../../domain/repositories';
import type { LiteLearnDb } from '../local/LiteLearnDb';
import { localSyncItemToDomain } from '../mappers/syncMapper';
import {
  coalesceSyncQueueRow,
  resolveActiveSessionUserId,
} from './syncQueueHelpers';

export class DexieSyncQueueRepository implements SyncQueueRepository {
  constructor(private readonly db: LiteLearnDb) {}

  async listPending(nowIso?: string): Promise<SyncQueueItem[]> {
    const rows = await this.db.syncQueue.orderBy('createdAt').toArray();
    const thresholdMs = nowIso ? Date.parse(nowIso) : Number.POSITIVE_INFINITY;

    return rows
      .filter((row) => {
        if (!row.nextRetryAt) {
          return true;
        }
        const retryMs = Date.parse(row.nextRetryAt);
        if (Number.isNaN(retryMs) || Number.isNaN(thresholdMs)) {
          return true;
        }
        return retryMs <= thresholdMs;
      })
      .map(localSyncItemToDomain);
  }

  async countPending(): Promise<number> {
    return this.db.syncQueue.count();
  }

  async enqueue(input: EnqueueSyncItemInput): Promise<SyncQueueItem> {
    const resolvedUserId =
      input.userId !== undefined
        ? input.userId
        : await resolveActiveSessionUserId(this.db);

    const row = await this.db.transaction('rw', this.db.syncQueue, async () => {
      // Also coalesce pending note entries targeting the same (userId, materialId) even if note UUID changed.
      if (input.entityType === 'note') {
        try {
          const nextNote = JSON.parse(input.payloadJson) as {
            userId?: string;
            materialId?: string;
          };
          if (nextNote.userId && nextNote.materialId) {
            const allRows = await this.db.syncQueue.toArray();
            const duplicateNoteIds: string[] = [];
            for (const existing of allRows) {
              if (existing.entityType !== 'note') {
                continue;
              }
              try {
                const parsed = JSON.parse(existing.payloadJson) as {
                  userId?: string;
                  materialId?: string;
                };
                if (
                  parsed.userId === nextNote.userId &&
                  parsed.materialId === nextNote.materialId
                ) {
                  duplicateNoteIds.push(existing.id);
                }
              } catch {
                // Ignore malformed payload.
              }
            }
            if (duplicateNoteIds.length > 0) {
              await this.db.syncQueue.bulkDelete(duplicateNoteIds);
            }
          }
        } catch {
          // Fall through to standard (entityType, entityId) coalescing.
        }
      }

      return coalesceSyncQueueRow(this.db, {
        userId: resolvedUserId,
        entityType: input.entityType,
        entityId: input.entityId,
        operation: input.operation,
        payloadJson: input.payloadJson,
      });
    });

    return localSyncItemToDomain(row);
  }

  async markFailed(
    id: string,
    errorMessage: string,
    nextRetryAt: string,
  ): Promise<void> {
    const existing = await this.db.syncQueue.get(id);
    if (!existing) {
      return;
    }
    await this.db.syncQueue.put({
      ...existing,
      attempts: existing.attempts + 1,
      lastError: errorMessage,
      nextRetryAt,
    });
  }

  async clearFailureState(): Promise<void> {
    const rows = await this.db.syncQueue.toArray();
    await this.db.syncQueue.bulkPut(
      rows.map((row) => ({
        ...row,
        lastError: null,
        nextRetryAt: null,
      })),
    );
  }

  async remove(id: string): Promise<void> {
    await this.db.syncQueue.delete(id);
  }
}
