import type { UserRole } from '../../domain/entities';
import { labels } from '../i18n/labels';

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function padTwo(value: number): string {
  return String(value).padStart(2, '0');
}

// Format ISO timestamps in 24-hour day-month-year form with zero dash punctuation.
export function formatDateTime(isoString: string): string {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return isoString;
  }
  const day = padTwo(parsed.getDate());
  const month = MONTH_NAMES[parsed.getMonth()] ?? 'Jan';
  const year = parsed.getFullYear();
  const hours = padTwo(parsed.getHours());
  const minutes = padTwo(parsed.getMinutes());
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

export function toDateTimeLocalValue(isoString: string): string {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  const year = parsed.getFullYear();
  const month = padTwo(parsed.getMonth() + 1);
  const day = padTwo(parsed.getDate());
  const hours = padTwo(parsed.getHours());
  const minutes = padTwo(parsed.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function isSafeHttpUrl(candidate: string | null | undefined): candidate is string {
  if (!candidate) {
    return false;
  }
  try {
    const parsed = new URL(candidate);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.hostname.length > 0
    );
  } catch {
    return false;
  }
}

export function formatWeekCode(prefix: string, weekNumber: number): string {
  return `${prefix} ${padTwo(weekNumber)}`;
}

export function formatRelativeDue(isoString: string, nowMs = Date.now()): string {
  const dueMs = Date.parse(isoString);
  if (Number.isNaN(dueMs)) {
    return '';
  }
  const diffMs = dueMs - nowMs;
  const absMinutes = Math.max(1, Math.round(Math.abs(diffMs) / 60_000));
  const absHours = Math.round(absMinutes / 60);
  const absDays = Math.round(absHours / 24);

  if (diffMs < 0) {
    if (absMinutes < 60) return `Overdue by ${absMinutes}m`;
    if (absHours < 48) return `Overdue by ${absHours}h`;
    return `Overdue by ${absDays}d`;
  }

  if (absMinutes < 60) return `Due in ${absMinutes}m`;
  if (absHours < 48) return `Due in ${absHours}h`;
  return `Due in ${absDays}d`;
}

export function getInitials(displayName: string): string {
  const parts = displayName
    .trim()
    .split(/\s+/)
    .filter((segment) => segment.length > 0);
  if (parts.length === 0) return 'ST';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

export function getRoleLabel(role: UserRole | null | undefined): string {
  if (role === 'admin') return labels.app.roleAdmin;
  if (role === 'lecturer') return labels.app.roleLecturer;
  if (role === 'assistant') return labels.app.roleAssistant;
  if (role === 'rep') return labels.app.roleRep;
  if (role === 'student') return labels.app.roleStudent;
  return labels.app.roleUnassigned;
}

export function getRoleSummary(role: UserRole): string {
  if (role === 'student') {
    return 'Follow courses, download PDFs offline, check deadlines, and write private study notes.';
  }
  if (role === 'rep') {
    return 'Coordinate your cohort by publishing courses, weekly outlines, deadlines, and announcements.';
  }
  if (role === 'lecturer') {
    return 'Publish lecture syllabi, weekly materials, PDF handouts, assignments, and announcements.';
  }
  if (role === 'assistant') {
    return 'Maintain lab modules, tutorial schedules, deadline updates, and announcements.';
  }
  return 'Manage class courses, content updates, and class member role permissions.';
}
