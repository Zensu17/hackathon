import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserNetworkStatusService } from '../../data/services/BrowserNetworkStatusService';

function stubBrowserEnv(options: {
  onLine?: boolean;
  effectiveType?: string;
  origin?: string;
}) {
  const listeners = new Map<string, Set<() => void>>();
  const connListeners = new Set<() => void>();

  const fakeWindow = {
    location: { origin: options.origin ?? 'https://litelearn.local' },
    addEventListener: vi.fn((event: string, cb: () => void) => {
      const bucket = listeners.get(event) ?? new Set<() => void>();
      bucket.add(cb);
      listeners.set(event, bucket);
    }),
    removeEventListener: vi.fn((event: string, cb: () => void) => {
      listeners.get(event)?.delete(cb);
    }),
  };

  const fakeNavigator = {
    onLine: options.onLine ?? true,
    connection: options.effectiveType
      ? {
          effectiveType: options.effectiveType,
          addEventListener: vi.fn((_type: string, cb: () => void) => {
            connListeners.add(cb);
          }),
          removeEventListener: vi.fn((_type: string, cb: () => void) => {
            connListeners.delete(cb);
          }),
        }
      : undefined,
  };

  vi.stubGlobal('window', fakeWindow);
  vi.stubGlobal('navigator', fakeNavigator);
  vi.stubGlobal('document', { visibilityState: 'visible' });

  return {
    fakeWindow,
    fakeNavigator,
    emitWindow(event: string) {
      for (const cb of listeners.get(event) ?? []) {
        cb();
      }
    },
  };
}

describe('BrowserNetworkStatusService', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reports offline immediately when navigator.onLine is false', async () => {
    // Arrange
    stubBrowserEnv({ onLine: false });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const service = new BrowserNetworkStatusService();

    // Act
    const result = await service.probeNow();

    // Assert
    expect(result).toBe('offline');
    expect(service.getStatus()).toBe('offline');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports slow immediately when Network Information API reports 2g or slow-2g', async () => {
    // Arrange
    stubBrowserEnv({ onLine: true, effectiveType: '2g' });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const service = new BrowserNetworkStatusService();

    // Act
    const result = await service.probeNow();

    // Assert
    expect(result).toBe('slow');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports online when HEAD probe succeeds under the 3000 ms latency threshold', async () => {
    // Arrange
    stubBrowserEnv({ onLine: true });
    let tick = 100;
    vi.spyOn(performance, 'now').mockImplementation(() => {
      const current = tick;
      tick += 250;
      return current;
    });
    const fetchSpy = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const service = new BrowserNetworkStatusService();

    // Act
    const result = await service.probeNow();

    // Assert
    expect(result).toBe('online');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://litelearn.local/robots.txt?_ping='),
      expect.objectContaining({ method: 'HEAD', cache: 'no-store' }),
    );
  });

  it('reports slow when HEAD probe latency exceeds 3000 ms or server returns 5xx', async () => {
    // Arrange
    stubBrowserEnv({ onLine: true });
    let tick = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => {
      const current = tick;
      tick += 3500;
      return current;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200 })),
    );
    const slowService = new BrowserNetworkStatusService();

    // Act
    const latencyResult = await slowService.probeNow();

    // Assert
    expect(latencyResult).toBe('slow');

    // Arrange 5xx case with fast latency
    vi.spyOn(performance, 'now').mockReturnValue(100);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 503 })),
    );
    const errorStatusResult = await slowService.probeNow();
    expect(errorStatusResult).toBe('slow');
  });

  it('reports slow when fetch rejects while navigator.onLine is true (connected but no internet)', async () => {
    // Arrange
    stubBrowserEnv({ onLine: true });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const service = new BrowserNetworkStatusService();

    // Act
    const result = await service.probeNow();

    // Assert
    expect(result).toBe('slow');
  });

  it('notifies subscribers on status transitions and removes listeners on final unsubscribe', async () => {
    // Arrange
    vi.useFakeTimers();
    const env = stubBrowserEnv({ onLine: true });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200 })),
    );
    const service = new BrowserNetworkStatusService();
    const received: string[] = [];

    // Act
    const unsub = service.subscribe((status) => {
      received.push(status);
    });
    env.emitWindow('offline');
    // Duplicate offline transition should be deduplicated.
    env.emitWindow('offline');
    unsub();

    // Assert
    expect(received).toEqual(['online', 'offline']);
    expect(env.fakeWindow.addEventListener).toHaveBeenCalledWith(
      'online',
      expect.any(Function),
    );
    expect(env.fakeWindow.addEventListener).toHaveBeenCalledWith(
      'offline',
      expect.any(Function),
    );
    expect(env.fakeWindow.removeEventListener).toHaveBeenCalledWith(
      'online',
      expect.any(Function),
    );
    expect(env.fakeWindow.removeEventListener).toHaveBeenCalledWith(
      'offline',
      expect.any(Function),
    );
  });
});
