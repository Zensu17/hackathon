import type { SyncEntityType, SyncOperation } from '../../domain/entities';
import type { LiteLearnDb, LocalSyncQueueRow } from '../local/LiteLearnDb';
import { generateUuid } from './HybridAuthRepository';

export async function resolveActiveSessionUserId(
  db: LiteLearnDb,
): Promise<string | null> {
  if (!db.sessions || typeof db.sessions.get !== 'function') {
    return null;
  }
  const session = await db.sessions.get('current');
  return session?.userId ?? null;
}

export interface CoalesceSyncQueueInput {
  userId?: string | null;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  payloadJson: string;
  createdAt?: string;
}

// Replace any superseded queued entry for the same (entityType, entityId) so older backed-off edits never overwrite newer ones.
export async function coalesceSyncQueueRow(
  db: LiteLearnDb,
  input: CoalesceSyncQueueInput,
): Promise<LocalSyncQueueRow> {
  const existingRows = await db.syncQueue
    .where('entityId')
    .equals(input.entityId)
    .toArray();
  const matching = existingRows.filter(
    (row) => row.entityType === input.entityType,
  );

  let mergedPayloadJson = input.payloadJson;

  // Preserve pending blob upload / superseded storage path metadata across chained offline material updates.
  if (input.entityType === 'material' && matching.length > 0) {
    try {
      const nextPayload = JSON.parse(input.payloadJson) as Record<
        string,
        unknown
      >;
      for (const prev of matching) {
        const prevPayload = JSON.parse(prev.payloadJson) as Record<
          string,
          unknown
        >;
        if (
          prevPayload.hasPendingBlob === true &&
          nextPayload.removeAttachment !== true &&
          nextPayload.hasPendingBlob !== true &&
          nextPayload.attachmentStoragePath
        ) {
          nextPayload.hasPendingBlob = true;
        }
        if (
          typeof prevPayload.previousStoragePath === 'string' &&
          prevPayload.previousStoragePath.length > 0 &&
          (!nextPayload.previousStoragePath ||
            nextPayload.previousStoragePath === nextPayload.attachmentStoragePath)
        ) {
          nextPayload.previousStoragePath = prevPayload.previousStoragePath;
        }
      }
      mergedPayloadJson = JSON.stringify(nextPayload);
    } catch {
      // Keep original payloadJson if any legacy queue row is unparseable.
    }
  }

  if (matching.length > 0) {
    await db.syncQueue.bulkDelete(matching.map((row) => row.id));
  }

  const resolvedUserId =
    input.userId !== undefined
      ? input.userId
      : await resolveActiveSessionUserId(db);

  const row: LocalSyncQueueRow = {
    id: generateUuid(),
    userId: resolvedUserId ?? null,
    entityType: input.entityType,
    entityId: input.entityId,
    operation: input.operation,
    payloadJson: mergedPayloadJson,
    attempts: 0,
    lastError: null,
    nextRetryAt: null,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };

  await db.syncQueue.put(row);
  return row;
}

export function extractQueueItemOwnerId(row: {
  userId?: string | null;
  entityType: SyncEntityType;
  payloadJson: string;
}): string | null {
  if (row.userId && row.userId.trim().length > 0) {
    return row.userId;
  }
  if (row.entityType === 'note' || row.entityType === 'course_follow') {
    try {
      const parsed = JSON.parse(row.payloadJson) as { userId?: unknown };
      if (typeof parsed.userId === 'string' && parsed.userId.trim().length > 0) {
        return parsed.userId;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export async function getPendingBlobMaterialIds(
  db: LiteLearnDb,
): Promise<Set<string>> {
  const rows = await db.syncQueue.toArray();
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.entityType !== 'material') {
      continue;
    }
    try {
      const parsed = JSON.parse(row.payloadJson) as {
        id?: unknown;
        hasPendingBlob?: unknown;
      };
      if (parsed.hasPendingBlob === true) {
        const materialId =
          typeof parsed.id === 'string' && parsed.id.length > 0
            ? parsed.id
            : row.entityId;
        ids.add(materialId);
      }
    } catch {
      // Ignore malformed queue rows.
    }
  }
  return ids;
}
