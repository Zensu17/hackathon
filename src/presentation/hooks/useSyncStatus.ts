import { useCallback, useEffect, useState } from 'react';
import { useAppContainer } from '../../app/di';

export interface SyncStatus {
  pendingChanges: number;
  hasFailedChanges: boolean;
  reload: () => Promise<void>;
  retry: () => Promise<void>;
}

export function useSyncStatus(): SyncStatus {
  const container = useAppContainer();
  const [pendingChanges, setPendingChanges] = useState(0);
  const [hasFailedChanges, setHasFailedChanges] = useState(false);

  const reload = useCallback(async (): Promise<void> => {
    const status = await container.getSyncStatus();
    setPendingChanges(status.pendingChanges);
    setHasFailedChanges(status.hasFailedChanges);
  }, [container]);

  const retry = useCallback(async (): Promise<void> => {
    await container.retrySync();
    await reload();
  }, [container, reload]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { pendingChanges, hasFailedChanges, reload, retry };
}
