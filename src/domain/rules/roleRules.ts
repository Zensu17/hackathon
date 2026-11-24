import type { UserRole } from '../entities/User';

export const USER_ROLES: readonly UserRole[] = [
  'student',
  'rep',
  'lecturer',
  'assistant',
  'admin',
] as const;

export const MANAGEMENT_ROLES: readonly UserRole[] = [
  'rep',
  'lecturer',
  'assistant',
  'admin',
] as const;

export function isValidUserRole(value: unknown): value is UserRole {
  return (
    typeof value === 'string' &&
    (USER_ROLES as readonly string[]).includes(value)
  );
}

export function canManageClassContent(role: UserRole | null | undefined): boolean {
  return (
    role === 'rep' ||
    role === 'lecturer' ||
    role === 'assistant' ||
    role === 'admin'
  );
}

export function isAdminRole(role: UserRole | null | undefined): boolean {
  return role === 'admin';
}
