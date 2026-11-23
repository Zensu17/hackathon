import { useEffect, useState } from 'react';
import { useAppContainer } from '../../app/di';
import type { ConnectionQuality } from '../../domain/services';

export type NetworkState = ConnectionQuality;

export function useNetworkStatus(): NetworkState {
  const container = useAppContainer();
  const [status, setStatus] = useState<NetworkState>(() =>
    container.networkStatus.getStatus(),
  );

  useEffect(() => {
    return container.networkStatus.subscribe((next) => {
      setStatus(next);
    });
  }, [container]);

  return status;
}
