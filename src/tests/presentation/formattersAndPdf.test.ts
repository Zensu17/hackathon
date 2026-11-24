import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatDateTime,
  formatRelativeDue,
  formatWeekCode,
  getInitials,
  isSafeHttpUrl,
  toDateTimeLocalValue,
} from '../../presentation/utils/formatters';
import { openOfflinePdfBlob } from '../../presentation/utils/openOfflinePdf';

describe('Presentation formatters and safe offline PDF opening', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('allows only http and https URLs with non-empty hostnames in isSafeHttpUrl', () => {
    // Arrange / Act / Assert
    expect(isSafeHttpUrl('https://del.ac.id/syllabus')).toBe(true);
    expect(isSafeHttpUrl('http://localhost:5173/handout')).toBe(true);

    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeHttpUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeHttpUrl('mailto:student@del.ac.id')).toBe(false);
    expect(isSafeHttpUrl('not a url')).toBe(false);
    expect(isSafeHttpUrl('')).toBe(false);
    expect(isSafeHttpUrl(null)).toBe(false);
    expect(isSafeHttpUrl(undefined)).toBe(false);
  });

  it('formats valid ISO timestamps in 24-hour day-month-year format and preserves invalid inputs', () => {
    // Arrange
    const sample = new Date(2026, 10, 5, 9, 7);
    const iso = sample.toISOString();

    // Act
    const formatted = formatDateTime(iso);
    const fallback = formatDateTime('not-a-date');

    // Assert
    expect(formatted).toBe('05 Nov 2026, 09:07');
    expect(fallback).toBe('not-a-date');
  });

  it('converts valid ISO timestamps to datetime-local input values and blanks invalid inputs', () => {
    // Arrange
    const sample = new Date(2026, 0, 9, 14, 5);

    // Act / Assert
    expect(toDateTimeLocalValue(sample.toISOString())).toBe('2026-01-09T14:05');
    expect(toDateTimeLocalValue('invalid-iso')).toBe('');
  });

  it('zero-pads single-digit week numbers in formatWeekCode', () => {
    // Arrange / Act / Assert
    expect(formatWeekCode('WK', 1)).toBe('WK 01');
    expect(formatWeekCode('Week', 12)).toBe('Week 12');
  });

  it('computes relative overdue labels across minutes, hours, and days', () => {
    // Arrange
    const nowMs = Date.parse('2026-11-24T12:00:00.000Z');

    // Act / Assert
    expect(formatRelativeDue('2026-11-24T11:40:00.000Z', nowMs)).toBe(
      'Overdue by 20m',
    );
    expect(formatRelativeDue('2026-11-24T06:00:00.000Z', nowMs)).toBe(
      'Overdue by 6h',
    );
    expect(formatRelativeDue('2026-11-21T12:00:00.000Z', nowMs)).toBe(
      'Overdue by 3d',
    );
  });

  it('computes relative upcoming due labels and returns empty string for invalid timestamps', () => {
    // Arrange
    const nowMs = Date.parse('2026-11-24T12:00:00.000Z');

    // Act / Assert
    expect(formatRelativeDue('2026-11-24T12:15:00.000Z', nowMs)).toBe(
      'Due in 15m',
    );
    expect(formatRelativeDue('2026-11-25T12:00:00.000Z', nowMs)).toBe(
      'Due in 24h',
    );
    expect(formatRelativeDue('2026-11-28T12:00:00.000Z', nowMs)).toBe(
      'Due in 4d',
    );
    expect(formatRelativeDue('bad-date', nowMs)).toBe('');
  });

  it('derives uppercase initials for empty, single-word, and multi-word display names', () => {
    // Arrange / Act / Assert
    expect(getInitials('   ')).toBe('ST');
    expect(getInitials('Albert')).toBe('AL');
    expect(getInitials('  Albert Damian Sitorus  ')).toBe('AS');
  });

  it('pins Blob MIME type to application/pdf, opens tab without noopener string, and nulls opener', () => {
    // Arrange
    vi.useFakeTimers();
    let capturedBlob: Blob | null = null;
    const createObjectURL = vi.fn((obj: Blob | MediaSource) => {
      if (obj instanceof Blob) {
        capturedBlob = obj;
      }
      return 'blob:https://litelearn.local/pdf-1';
    });
    const revokeObjectURL = vi.fn();
    const fakePopup: { opener: unknown } = { opener: { secret: true } };
    const openSpy = vi.fn(() => fakePopup);
    const clickSpy = vi.fn();

    vi.spyOn(URL, 'createObjectURL').mockImplementation(createObjectURL);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revokeObjectURL);
    vi.stubGlobal('window', {
      open: openSpy,
      setTimeout: globalThis.setTimeout.bind(globalThis),
    });
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({ href: '', download: '', click: clickSpy })),
    });

    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

    // Act
    openOfflinePdfBlob(bytes, 'week1.pdf');

    // Assert
    expect(capturedBlob).not.toBeNull();
    expect(capturedBlob!.type).toBe('application/pdf');
    expect(openSpy).toHaveBeenCalledWith(
      'blob:https://litelearn.local/pdf-1',
      '_blank',
    );
    expect(fakePopup.opener).toBeNull();
    expect(clickSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(60_000);
    expect(revokeObjectURL).toHaveBeenCalledWith(
      'blob:https://litelearn.local/pdf-1',
    );
  });

  it('falls back to a download anchor with .pdf extension only when window.open is blocked', () => {
    // Arrange
    vi.useFakeTimers();
    const createdAnchor = { href: '', download: '', click: vi.fn() };
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:https://litelearn.local/pdf-2');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.stubGlobal('window', {
      open: vi.fn(() => null),
      setTimeout: globalThis.setTimeout.bind(globalThis),
    });
    vi.stubGlobal('document', {
      createElement: vi.fn(() => createdAnchor),
    });

    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

    // Act
    openOfflinePdfBlob(bytes, 'lecture-notes');

    // Assert
    expect(createdAnchor.href).toBe('blob:https://litelearn.local/pdf-2');
    expect(createdAnchor.download).toBe('lecture-notes.pdf');
    expect(createdAnchor.click).toHaveBeenCalledTimes(1);
  });

  it('preserves existing .pdf suffix on fallback downloads without doubling extension', () => {
    // Arrange
    const createdAnchor = { href: '', download: '', click: vi.fn() };
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:https://litelearn.local/pdf-3');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.stubGlobal('window', {
      open: vi.fn(() => null),
      setTimeout: vi.fn(),
    });
    vi.stubGlobal('document', {
      createElement: vi.fn(() => createdAnchor),
    });

    // Act
    openOfflinePdfBlob(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), 'Week01.PDF');

    // Assert
    expect(createdAnchor.download).toBe('Week01.PDF');
  });
});
