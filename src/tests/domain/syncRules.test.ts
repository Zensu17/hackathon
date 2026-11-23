import { describe, expect, it } from 'vitest';
import {
  BASE_SYNC_BACKOFF_MS,
  calculateBackoffDelayMs,
  isDueForRetry,
  MAX_SYNC_BACKOFF_MS,
  shouldAutoDownloadMaterial,
  SUB_ONE_MB_BYTES,
} from '../../domain/rules';

describe('syncRules and Data Saver auto-download rules', () => {
  it('computes bounded exponential backoff delays for failed sync items', () => {
    expect(calculateBackoffDelayMs(0)).toBe(BASE_SYNC_BACKOFF_MS);
    expect(calculateBackoffDelayMs(1)).toBe(BASE_SYNC_BACKOFF_MS * 2);
    expect(calculateBackoffDelayMs(2)).toBe(BASE_SYNC_BACKOFF_MS * 4);
    expect(calculateBackoffDelayMs(20)).toBe(MAX_SYNC_BACKOFF_MS);
    expect(calculateBackoffDelayMs(-3)).toBe(BASE_SYNC_BACKOFF_MS);
  });

  it('determines whether a queued item is eligible for retry', () => {
    const nowMs = Date.parse('2026-11-23T09:00:00.000Z');
    expect(isDueForRetry(null, nowMs)).toBe(true);
    expect(isDueForRetry('2026-11-23T08:59:59.000Z', nowMs)).toBe(true);
    expect(isDueForRetry('2026-11-23T09:00:00.000Z', nowMs)).toBe(true);
    expect(isDueForRetry('2026-11-23T09:00:01.000Z', nowMs)).toBe(false);
  });

  it('never auto-downloads PDFs when Data Saver is ON, and caps OFF prefetch strictly under 1 MB', () => {
    expect(shouldAutoDownloadMaterial(200_000, true)).toBe(false);
    expect(shouldAutoDownloadMaterial(1, true)).toBe(false);
    expect(shouldAutoDownloadMaterial(0, false)).toBe(false);
    expect(shouldAutoDownloadMaterial(SUB_ONE_MB_BYTES - 1, false)).toBe(true);
    expect(shouldAutoDownloadMaterial(SUB_ONE_MB_BYTES, false)).toBe(false);
    expect(shouldAutoDownloadMaterial(SUB_ONE_MB_BYTES + 100, false)).toBe(
      false,
    );
  });
});
