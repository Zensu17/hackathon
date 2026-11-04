import type { SyncQueueItem } from '../../domain/entities';
import type { LocalSyncQueueRow } from '../local/LiteLearnDb';

export function localSyncItemToDomain(row: LocalSyncQueueRow): SyncQueueItem {
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    operation: row.operation,
    payloadJson: row.payloadJson,
    attempts: row.attempts,
    lastError: row.lastError,
    nextRetryAt: row.nextRetryAt,
    createdAt: row.createdAt,
  };
}

export function domainSyncItemToLocal(item: SyncQueueItem): LocalSyncQueueRow {
  return {
    id: item.id,
    entityType: item.entityType,
    entityId: item.entityId,
    operation: item.operation,
    payloadJson: item.payloadJson,
    attempts: item.attempts,
    lastError: item.lastError,
    nextRetryAt: item.nextRetryAt,
    createdAt: item.createdAt,
  };
}
