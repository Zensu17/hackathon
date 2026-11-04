export const DEFAULT_ALLOWED_CAMPUS_DOMAINS = [
  'students.del.ac.id',
  'del.ac.id',
] as const;

const LOCAL_PART_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
const DOMAIN_PART_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

function normalizeDomainEntry(entry: string): string {
  return entry.trim().replace(/^@+/, '').toLowerCase();
}

export function parseAllowedEmailDomains(raw: string | undefined): string[] {
  if (!raw) {
    return [...DEFAULT_ALLOWED_CAMPUS_DOMAINS];
  }

  const parsed = raw
    .split(',')
    .map(normalizeDomainEntry)
    .filter((domain) => domain.length > 0);

  if (parsed.length === 0) {
    return [...DEFAULT_ALLOWED_CAMPUS_DOMAINS];
  }

  return Array.from(new Set(parsed));
}

// Match the exact domain after a single @ so unlisted subdomains like fake.del.ac.id are rejected.
export function isAllowedCampusEmail(
  email: string,
  allowedDomains: readonly string[] = DEFAULT_ALLOWED_CAMPUS_DOMAINS,
): boolean {
  const normalized = email.trim().toLowerCase();
  if (normalized.length === 0 || /\s/.test(normalized)) {
    return false;
  }

  const parts = normalized.split('@');
  if (parts.length !== 2) {
    return false;
  }

  const [localPart, domainPart] = parts;
  if (
    !localPart ||
    !domainPart ||
    localPart.length > 64 ||
    localPart.startsWith('.') ||
    localPart.endsWith('.') ||
    localPart.includes('..') ||
    !LOCAL_PART_PATTERN.test(localPart) ||
    !DOMAIN_PART_PATTERN.test(domainPart)
  ) {
    return false;
  }

  const normalizedAllowed = allowedDomains
    .map(normalizeDomainEntry)
    .filter((domain) => domain.length > 0);

  if (normalizedAllowed.length === 0) {
    return false;
  }

  if (normalizedAllowed.includes('*')) {
    return true;
  }

  return normalizedAllowed.includes(domainPart);
}
