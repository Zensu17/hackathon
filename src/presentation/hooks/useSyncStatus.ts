import { useCallback, useEffect, useState } from 'react';
import { useAppContainer } from '../../app/di';
import type { SyncStateSummary } from '../../domain/services';
import { useAuthSession } from './useAuthSession';

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncAt: string | null;
  pendingChanges: number;
  hasFailedChanges: boolean;
  lastError: string | null;
  mode: 'local' | 'remote';
  reload: () => Promise<void>;
  syncNow: () => Promise<SyncStateSummary | null>;
  retry: () => Promise<void>;
}

export function useSyncStatus(): SyncStatus {
  const container = useAppContainer();
  const { session } = useAuthSession();
  const userId = session?.user.id ?? null;

  const [state, setState] = useState<SyncStateSummary>({
    isSyncing: false,
    lastSyncAt: null,
    pendingCount: 0,
    hasFailedChanges: false,
    lastError: null,
    mode: container.isLocalFallbackMode ? 'local' : 'remote',
  });

  const reload = useCallback(async (): Promise<void> => {
    const next = await container.getSyncState();
    setState(next);
  }, [container]);

  const syncNow = useCallback(async (): Promise<SyncStateSummary | null> => {
    if (!userId) {
      await reload();
      return null;
    }
    setState((prev) => ({ ...prev, isSyncing: true, lastError: null }));
    try {
      const next = await container.usecases.runSync.execute({ userId });
      setState(next);
      return next;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Sync failed. Local data is safe.';
      setState((prev) => ({ ...prev, isSyncing: false, lastError: message }));
      return null;
    }
  }, [container, reload, userId]);

  const retry = useCallback(async (): Promise<void> => {
    if (!userId) {
      await container.retrySync();
      await reload();
      return;
    }
    setState((prev) => ({ ...prev, isSyncing: true, lastError: null }));
    const next = await container.usecases.runSync.execute({
      userId,
      retryFailed: true,
    });
    setState(next);
  }, [container, reload, userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!userId || typeof window === 'undefined') {
      return;
    }

    const handleOnline = (): void => {
      void syncNow();
    };

    window.addEventListener('online', handleOnline);
    const interval = window.setInterval(() => {
      if (
        navigator.onLine &&
        (typeof document === 'undefined' ||
          document.visibilityState === 'visible')
      ) {
        void syncNow();
      }
    }, AUTO_SYNC_INTERVAL_MS);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.clearInterval(interval);
    };
  }, [syncNow, userId]);

  return {
    isSyncing: state.isSyncing,
    lastSyncAt: state.lastSyncAt,
    pendingChanges: state.pendingCount,
    hasFailedChanges: state.hasFailedChanges,
    lastError: state.lastError,
    mode: state.mode,
    reload,
    syncNow,
    retry,
  };
}
