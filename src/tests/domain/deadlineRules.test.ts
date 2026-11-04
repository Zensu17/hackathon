import { describe, expect, it } from 'vitest';
import {
  TWENTY_FOUR_HOURS_MS,
  isDueSoon,
  isOverdue,
  sortDeadlines,
} from '../../domain/rules/deadlineRules';

describe('deadlineRules', () => {
  const nowIso = '2026-11-04T12:00:00.000Z';

  describe('isOverdue', () => {
    it('returns true when dueAt is strictly earlier than now', () => {
      expect(isOverdue('2026-11-04T11:59:59.999Z', nowIso)).toBe(true);
      expect(isOverdue('2026-11-03T12:00:00.000Z', nowIso)).toBe(true);
    });

    it('returns false when dueAt equals now or is in the future', () => {
      expect(isOverdue(nowIso, nowIso)).toBe(false);
      expect(isOverdue('2026-11-04T12:00:00.001Z', nowIso)).toBe(false);
      expect(isOverdue('2026-11-10T00:00:00.000Z', nowIso)).toBe(false);
    });

    it('returns false when either timestamp is unparseable', () => {
      expect(isOverdue('not-a-date', nowIso)).toBe(false);
      expect(isOverdue(nowIso, 'invalid-now')).toBe(false);
    });
  });

  describe('isDueSoon', () => {
    it('returns true from exact now through exact +24h boundary', () => {
      expect(TWENTY_FOUR_HOURS_MS).toBe(86_400_000);
      expect(isDueSoon(nowIso, nowIso)).toBe(true);
      expect(isDueSoon('2026-11-04T18:00:00.000Z', nowIso)).toBe(true);
      expect(isDueSoon('2026-11-05T12:00:00.000Z', nowIso)).toBe(true);
    });

    it('returns false when already overdue or strictly beyond +24h', () => {
      expect(isDueSoon('2026-11-04T11:59:59.999Z', nowIso)).toBe(false);
      expect(isDueSoon('2026-11-05T12:00:00.001Z', nowIso)).toBe(false);
    });

    it('returns false for unparseable date strings', () => {
      expect(isDueSoon('invalid', nowIso)).toBe(false);
      expect(isDueSoon(nowIso, '')).toBe(false);
    });
  });

  describe('sortDeadlines', () => {
    it('returns a new array sorted ascending by dueAt with deterministic id tie-breaking', () => {
      const original = [
        { id: 'dl-3', dueAt: '2026-11-06T09:00:00.000Z', title: 'Later' },
        { id: 'dl-2', dueAt: '2026-11-04T17:00:00+07:00', title: 'Tie B (10:00Z)' },
        { id: 'dl-1', dueAt: '2026-11-04T10:00:00.000Z', title: 'Tie A (10:00Z)' },
        { id: 'dl-0', dueAt: '2026-11-03T23:59:00.000Z', title: 'Earliest' },
      ];
      const snapshot = original.map((item) => ({ ...item }));

      const sorted = sortDeadlines(original);

      expect(sorted).not.toBe(original);
      expect(original).toEqual(snapshot);
      expect(sorted.map((item) => item.id)).toEqual(['dl-0', 'dl-1', 'dl-2', 'dl-3']);
    });

    it('places valid timestamps ahead of unparseable timestamps deterministically', () => {
      const items = [
        { id: 'bad-b', dueAt: 'invalid' },
        { id: 'good-1', dueAt: '2026-11-05T00:00:00.000Z' },
        { id: 'bad-a', dueAt: 'not-iso' },
      ];

      expect(sortDeadlines(items).map((item) => item.id)).toEqual([
        'good-1',
        'bad-a',
        'bad-b',
      ]);
    });
  });
});
