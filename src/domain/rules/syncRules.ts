export const BASE_SYNC_BACKOFF_MS = 2000;
export const MAX_SYNC_BACKOFF_MS = 5 * 60 * 1000;

export function calculateBackoffDelayMs(attempts: number): number {
  const safeAttempts = Math.max(0, Math.floor(attempts));
  const delay = BASE_SYNC_BACKOFF_MS * 2 ** safeAttempts;
  return Math.min(MAX_SYNC_BACKOFF_MS, delay);
}

export function isDueForRetry(
  nextRetryAt: string | null,
  nowMs: number,
): boolean {
  if (!nextRetryAt) {
    return true;
  }
  const retryMs = Date.parse(nextRetryAt);
  if (Number.isNaN(retryMs)) {
    return true;
  }
  return retryMs <= nowMs;
}
