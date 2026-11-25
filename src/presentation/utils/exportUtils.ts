import type { UpcomingDeadlineDto } from '../../application/dto';
import type { Class, User } from '../../domain/entities';
import { getRoleLabel } from './formatters';

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function padTwo(value: number): string {
  return String(value).padStart(2, '0');
}

function formatIcsUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}` +
    `${padTwo(date.getUTCMonth() + 1)}` +
    `${padTwo(date.getUTCDate())}` +
    `T${padTwo(date.getUTCHours())}` +
    `${padTwo(date.getUTCMinutes())}` +
    `${padTwo(date.getUTCSeconds())}Z`
  );
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function sanitizeUidPart(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]/g, '-');
  return cleaned.length > 0 ? cleaned : 'deadline';
}

/**
 * Serialize upcoming deadlines into an RFC 5545 iCalendar document so students
 * can import study deadlines into offline or system calendar apps.
 */
export function buildDeadlinesIcs(
  items: ReadonlyArray<UpcomingDeadlineDto>,
  now: Date = new Date(),
): string {
  const dtStamp = formatIcsUtc(now);
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LiteLearn//Campus Study Workspace//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:LiteLearn Deadlines',
  ];

  for (const item of items) {
    const dueDate = new Date(item.dueAt);
    if (Number.isNaN(dueDate.getTime())) {
      continue;
    }
    const endDate = new Date(dueDate.getTime() + 30 * 60_000);
    const descriptionParts = [
      `${item.courseCode} - ${item.courseName}`,
      item.description.trim(),
    ].filter((part) => part.length > 0);

    lines.push(
      'BEGIN:VEVENT',
      `UID:${sanitizeUidPart(item.id)}@litelearn.local`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${formatIcsUtc(dueDate)}`,
      `DTEND:${formatIcsUtc(endDate)}`,
      `SUMMARY:${escapeIcsText(`[${item.courseCode}] ${item.title}`)}`,
      `DESCRIPTION:${escapeIcsText(descriptionParts.join('\n\n'))}`,
      `CATEGORIES:${escapeIcsText(item.courseCode)}`,
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR', '');
  return lines.join('\r\n');
}

function escapeCsvCell(raw: string): string {
  const neutralized = FORMULA_PREFIX.test(raw) ? `'${raw}` : raw;
  if (
    neutralized.includes('"') ||
    neutralized.includes(',') ||
    neutralized.includes('\n') ||
    neutralized.includes('\r')
  ) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
}

/**
 * Serialize filtered directory users into an RFC 4180 CSV export with
 * formula-injection neutralization for spreadsheet apps.
 */
export function buildUsersCsv(
  users: ReadonlyArray<User>,
  classById: ReadonlyMap<string, Class>,
): string {
  const header = [
    'NIM',
    'Display Name',
    'Role',
    'Class',
    'Join Code',
    'Study Program',
    'Status',
    'Created At',
  ];

  const rows: string[] = [header.map(escapeCsvCell).join(',')];

  for (const user of users) {
    const cls = user.classId ? classById.get(user.classId) : undefined;
    const row = [
      user.nim,
      user.displayName,
      getRoleLabel(user.role),
      cls?.name ?? 'Unassigned',
      cls?.joinCode ?? '',
      user.studyProgram ?? '',
      user.deletedAt ? 'Inactive' : 'Active',
      user.createdAt,
    ];
    rows.push(row.map(escapeCsvCell).join(','));
  }

  return `${rows.join('\r\n')}\r\n`;
}

/**
 * Trigger a client-side file download from an in-memory text payload.
 */
export function triggerTextDownload(
  fileName: string,
  content: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 60_000);
}
