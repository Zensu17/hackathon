import type {
  SyncEntityType,
  SyncOperation,
  SyncQueueItem,
} from '../entities/SyncQueueItem';

export interface EnqueueSyncItemInput {
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  payloadJson: string;
}

export interface SyncQueueRepository {
  listPending(nowIso?: string): Promise<SyncQueueItem[]>;
  countPending(): Promise<number>;
  enqueue(input: EnqueueSyncItemInput): Promise<SyncQueueItem>;
  markFailed(id: string, errorMessage: string, nextRetryAt: string): Promise<void>;
  remove(id: string): Promise<void>;
}
