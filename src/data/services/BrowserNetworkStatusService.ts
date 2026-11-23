import type {
  ConnectionQuality,
  NetworkStatusListener,
  NetworkStatusService,
} from '../../domain/services';

const SLOW_THRESHOLD_MS = 3000;
const PROBE_TIMEOUT_MS = 5000;
const PROBE_INTERVAL_MS = 30000;

interface NavigatorWithConnection extends Navigator {
  connection?: {
    effectiveType?: string;
    addEventListener?: (type: string, listener: () => void) => void;
    removeEventListener?: (type: string, listener: () => void) => void;
  };
}

// Measure real reachability and latency so "connected but no internet" and slow dorm Wi-Fi are detected accurately.
export class BrowserNetworkStatusService implements NetworkStatusService {
  private status: ConnectionQuality;
  private readonly listeners = new Set<NetworkStatusListener>();
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private isListening = false;
  private readonly probeUrl: string | null;

  constructor(options: { probeUrl?: string | null } = {}) {
    this.probeUrl = options.probeUrl ?? null;
    this.status = this.readInitialStatus();
  }

  private readInitialStatus(): ConnectionQuality {
    if (typeof navigator === 'undefined') {
      return 'online';
    }
    if (navigator.onLine === false) {
      return 'offline';
    }
    const nav = navigator as NavigatorWithConnection;
    const effective = nav.connection?.effectiveType;
    if (effective === 'slow-2g' || effective === '2g') {
      return 'slow';
    }
    return 'online';
  }

  private emit(next: ConnectionQuality): void {
    if (this.status === next) {
      return;
    }
    this.status = next;
    for (const listener of this.listeners) {
      listener(next);
    }
  }

  async probeNow(): Promise<ConnectionQuality> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.emit('offline');
      return 'offline';
    }

    const nav = typeof navigator !== 'undefined' ? (navigator as NavigatorWithConnection) : null;
    const effective = nav?.connection?.effectiveType;
    if (effective === 'slow-2g' || effective === '2g') {
      this.emit('slow');
      return 'slow';
    }

    if (typeof fetch !== 'function' || typeof window === 'undefined') {
      this.emit('online');
      return 'online';
    }

    const target = this.probeUrl ?? `${window.location.origin}/robots.txt`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const startMs = performance.now();

    try {
      const response = await fetch(`${target}${target.includes('?') ? '&' : '?'}_ping=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });
      const elapsedMs = performance.now() - startMs;
      if (!response.ok && response.status >= 500) {
        this.emit('slow');
        return 'slow';
      }
      const next: ConnectionQuality = elapsedMs > SLOW_THRESHOLD_MS ? 'slow' : 'online';
      this.emit(next);
      return next;
    } catch {
      const next: ConnectionQuality =
        typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'slow';
      this.emit(next);
      return next;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private readonly handleOnline = (): void => {
    void this.probeNow();
  };

  private readonly handleOffline = (): void => {
    this.emit('offline');
  };

  private readonly handleConnectionChange = (): void => {
    void this.probeNow();
  };

  private startListeners(): void {
    if (this.isListening || typeof window === 'undefined') {
      return;
    }
    this.isListening = true;
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    const nav = navigator as NavigatorWithConnection;
    nav.connection?.addEventListener?.('change', this.handleConnectionChange);

    void this.probeNow();
    this.intervalHandle = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void this.probeNow();
      }
    }, PROBE_INTERVAL_MS);
  }

  private stopListeners(): void {
    if (!this.isListening || typeof window === 'undefined') {
      return;
    }
    this.isListening = false;
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);

    const nav = navigator as NavigatorWithConnection;
    nav.connection?.removeEventListener?.('change', this.handleConnectionChange);

    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  getStatus(): ConnectionQuality {
    return this.status;
  }

  subscribe(listener: NetworkStatusListener): () => void {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      this.startListeners();
    }
    listener(this.status);

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stopListeners();
      }
    };
  }
}
