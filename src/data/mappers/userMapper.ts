import type { User, UserRole } from '../../domain/entities';
import type { LocalUserRow } from '../local/LiteLearnDb';

export interface RemoteProfileRow {
  id: string;
  nim: string;
  display_name: string;
  class_id: string | null;
  role: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function parseUserRole(raw: string | null): UserRole | null {
  if (raw === 'student' || raw === 'rep') {
    return raw;
  }
  return null;
}

export function localUserToDomain(row: LocalUserRow): User {
  return {
    id: row.id,
    nim: row.nim,
    displayName: row.displayName,
    classId: row.classId,
    role: row.role,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export function domainUserToLocal(user: User): LocalUserRow {
  return {
    id: user.id,
    nim: user.nim,
    displayName: user.displayName,
    classId: user.classId,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    deletedAt: user.deletedAt,
  };
}

export function remoteProfileToDomain(row: RemoteProfileRow): User {
  return {
    id: row.id,
    nim: row.nim,
    displayName: row.display_name,
    classId: row.class_id,
    role: parseUserRole(row.role),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}
