export type SyncEntityType =
  | 'course'
  | 'week'
  | 'material'
  | 'deadline'
  | 'announcement'
  | 'note'
  | 'course_follow';

export type SyncOperation = 'upsert' | 'delete';

export interface SyncQueueItem {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  payloadJson: string;
  attempts: number;
  lastError: string | null;
  nextRetryAt: string | null;
  createdAt: string;
}
