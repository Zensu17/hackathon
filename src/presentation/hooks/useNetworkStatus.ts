import { useEffect, useState } from 'react';
import { useAuthSession } from './useAuthSession';

export type NetworkState = 'online' | 'slow' | 'offline';

export function useNetworkStatus(): NetworkState {
  const { isLocalFallbackMode } = useAuthSession();
  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = (): void => setIsBrowserOnline(true);
    const handleOffline = (): void => setIsBrowserOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isBrowserOnline) {
    return 'offline';
  }

  if (isLocalFallbackMode) {
    return 'slow';
  }

  return 'online';
}
