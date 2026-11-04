import type { Class } from '../../domain/entities';
import type { LocalClassRow } from '../local/LiteLearnDb';

export interface RemoteClassRow {
  id: string;
  name: string;
  join_code: string;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function localClassToDomain(row: LocalClassRow): Class {
  return {
    id: row.id,
    name: row.name,
    joinCode: row.joinCode,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export function domainClassToLocal(item: Class): LocalClassRow {
  return {
    id: item.id,
    name: item.name,
    joinCode: item.joinCode,
    createdByUserId: item.createdByUserId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    deletedAt: item.deletedAt,
  };
}

export function remoteClassToDomain(row: RemoteClassRow): Class {
  return {
    id: row.id,
    name: row.name,
    joinCode: row.join_code,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}
