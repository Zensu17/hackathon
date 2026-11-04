export interface SyncStateSummary {
  isSyncing: boolean;
  lastSyncAt: string | null;
  pendingCount: number;
  lastError: string | null;
}

export interface SyncService {
  syncNow(userId: string): Promise<SyncStateSummary>;
  getSyncState(): Promise<SyncStateSummary>;
}
