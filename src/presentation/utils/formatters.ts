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
  return `[${prefix} ${padTwo(weekNumber)}]`;
}
