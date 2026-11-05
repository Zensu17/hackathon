import type { SyncQueueItem } from '../../domain/entities';
import type {
  EnqueueSyncItemInput,
  SyncQueueRepository,
} from '../../domain/repositories';
import type { LiteLearnDb } from '../local/LiteLearnDb';
import {
  domainSyncItemToLocal,
  localSyncItemToDomain,
} from '../mappers/syncMapper';
import { generateUuid } from './HybridAuthRepository';

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
    const item: SyncQueueItem = {
      id: generateUuid(),
      entityType: input.entityType,
      entityId: input.entityId,
      operation: input.operation,
      payloadJson: input.payloadJson,
      attempts: 0,
      lastError: null,
      nextRetryAt: null,
      createdAt: new Date().toISOString(),
    };
    await this.db.syncQueue.put(domainSyncItemToLocal(item));
    return item;
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
