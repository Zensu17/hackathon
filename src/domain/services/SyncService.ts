export interface SyncStateSummary {
  isSyncing: boolean;
  lastSyncAt: string | null;
  pendingCount: number;
  hasFailedChanges: boolean;
  lastError: string | null;
  mode: 'local' | 'remote';
}

export interface SyncService {
  syncNow(userId: string): Promise<SyncStateSummary>;
  retryFailed(userId: string): Promise<SyncStateSummary>;
  getSyncState(): Promise<SyncStateSummary>;
}
