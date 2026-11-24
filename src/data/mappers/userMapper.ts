import type { User, UserRole } from '../../domain/entities';
import { isValidUserRole } from '../../domain/rules';
import type { LocalUserRow } from '../local/LiteLearnDb';

export interface RemoteProfileRow {
  id: string;
  nim: string;
  display_name: string;
  class_id: string | null;
  role: string | null;
  study_program?: string | null;
  bio?: string | null;
  avatar_color?: string | null;
  avatar_data_url?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function parseUserRole(raw: string | null): UserRole | null {
  return isValidUserRole(raw) ? raw : null;
}

export function localUserToDomain(row: LocalUserRow): User {
  return {
    id: row.id,
    nim: row.nim,
    displayName: row.displayName,
    classId: row.classId,
    role: row.role,
    ...(row.studyProgram !== undefined ? { studyProgram: row.studyProgram } : {}),
    ...(row.bio !== undefined ? { bio: row.bio } : {}),
    ...(row.avatarColor !== undefined ? { avatarColor: row.avatarColor } : {}),
    ...(row.avatarDataUrl !== undefined ? { avatarDataUrl: row.avatarDataUrl } : {}),
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
    ...(user.studyProgram !== undefined ? { studyProgram: user.studyProgram } : {}),
    ...(user.bio !== undefined ? { bio: user.bio } : {}),
    ...(user.avatarColor !== undefined ? { avatarColor: user.avatarColor } : {}),
    ...(user.avatarDataUrl !== undefined ? { avatarDataUrl: user.avatarDataUrl } : {}),
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
    ...(row.study_program !== undefined && row.study_program !== null
      ? { studyProgram: row.study_program }
      : {}),
    ...(row.bio !== undefined && row.bio !== null ? { bio: row.bio } : {}),
    ...(row.avatar_color !== undefined && row.avatar_color !== null
      ? { avatarColor: row.avatar_color }
      : {}),
    ...(row.avatar_data_url !== undefined
      ? { avatarDataUrl: row.avatar_data_url }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}
