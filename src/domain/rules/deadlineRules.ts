import type { Deadline } from '../entities/Deadline';

export const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function isOverdue(dueAtIso: string, nowIso: string): boolean {
  const dueMs = Date.parse(dueAtIso);
  const nowMs = Date.parse(nowIso);
  if (Number.isNaN(dueMs) || Number.isNaN(nowMs)) {
    return false;
  }
  return dueMs < nowMs;
}

export function isDueSoon(dueAtIso: string, nowIso: string): boolean {
  const dueMs = Date.parse(dueAtIso);
  const nowMs = Date.parse(nowIso);
  if (Number.isNaN(dueMs) || Number.isNaN(nowMs)) {
    return false;
  }
  const deltaMs = dueMs - nowMs;
  return deltaMs >= 0 && deltaMs <= TWENTY_FOUR_HOURS_MS;
}

export function sortDeadlines<T extends Pick<Deadline, 'id' | 'dueAt'>>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => {
    const aMs = Date.parse(a.dueAt);
    const bMs = Date.parse(b.dueAt);
    const aInvalid = Number.isNaN(aMs);
    const bInvalid = Number.isNaN(bMs);

    if (aInvalid && bInvalid) {
      return a.id.localeCompare(b.id);
    }
    if (aInvalid) {
      return 1;
    }
    if (bInvalid) {
      return -1;
    }
    if (aMs !== bMs) {
      return aMs - bMs;
    }
    return a.id.localeCompare(b.id);
  });
}
