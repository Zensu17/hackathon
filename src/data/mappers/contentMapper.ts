import type {
  Announcement,
  Deadline,
  Material,
  MaterialAttachment,
  Note,
  Week,
} from '../../domain/entities';
import type {
  LocalAnnouncementRow,
  LocalDeadlineRow,
  LocalMaterialRow,
  LocalNoteRow,
  LocalWeekRow,
} from '../local/LiteLearnDb';

export interface RemoteWeekRow {
  id: string;
  course_id: string;
  week_number: number;
  title: string;
  summary: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RemoteMaterialRow {
  id: string;
  course_id: string;
  week_id: string;
  title: string;
  description: string;
  external_url: string | null;
  attachment_name: string | null;
  attachment_size_bytes: number | null;
  attachment_mime_type: string | null;
  attachment_storage_path: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RemoteDeadlineRow {
  id: string;
  course_id: string;
  week_id: string | null;
  title: string;
  description: string;
  due_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RemoteAnnouncementRow {
  id: string;
  course_id: string;
  title: string;
  body: string;
  posted_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RemoteNoteRow {
  id: string;
  user_id: string;
  material_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function localWeekToDomain(row: LocalWeekRow): Week {
  return {
    id: row.id,
    courseId: row.courseId,
    weekNumber: row.weekNumber,
    title: row.title,
    summary: row.summary,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export function domainWeekToLocal(week: Week): LocalWeekRow {
  return {
    id: week.id,
    courseId: week.courseId,
    weekNumber: week.weekNumber,
    title: week.title,
    summary: week.summary,
    createdAt: week.createdAt,
    updatedAt: week.updatedAt,
    deletedAt: week.deletedAt,
  };
}

export function remoteWeekToDomain(row: RemoteWeekRow): Week {
  return {
    id: row.id,
    courseId: row.course_id,
    weekNumber: row.week_number,
    title: row.title,
    summary: row.summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function localMaterialToDomain(row: LocalMaterialRow): Material {
  const hasAttachment =
    row.attachmentName !== null &&
    row.attachmentSizeBytes !== null &&
    row.attachmentMimeType !== null &&
    row.attachmentStoragePath !== null;

  const attachment: MaterialAttachment | null = hasAttachment
    ? {
        name: row.attachmentName ?? '',
        sizeBytes: row.attachmentSizeBytes ?? 0,
        mimeType: row.attachmentMimeType ?? 'application/pdf',
        storagePath: row.attachmentStoragePath ?? '',
        remoteUrl: row.attachmentRemoteUrl,
      }
    : null;

  return {
    id: row.id,
    courseId: row.courseId,
    weekId: row.weekId,
    title: row.title,
    description: row.description,
    externalUrl: row.externalUrl,
    attachment,
    isAvailableOffline: row.isAvailableOffline,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export function domainMaterialToLocal(material: Material): LocalMaterialRow {
  return {
    id: material.id,
    courseId: material.courseId,
    weekId: material.weekId,
    title: material.title,
    description: material.description,
    externalUrl: material.externalUrl,
    attachmentName: material.attachment ? material.attachment.name : null,
    attachmentSizeBytes: material.attachment
      ? material.attachment.sizeBytes
      : null,
    attachmentMimeType: material.attachment
      ? material.attachment.mimeType
      : null,
    attachmentStoragePath: material.attachment
      ? material.attachment.storagePath
      : null,
    attachmentRemoteUrl: material.attachment
      ? material.attachment.remoteUrl
      : null,
    isAvailableOffline: material.isAvailableOffline,
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
    deletedAt: material.deletedAt,
  };
}

export function remoteMaterialToDomain(
  row: RemoteMaterialRow,
  options: { remoteUrl?: string | null; isAvailableOffline?: boolean } = {},
): Material {
  const hasAttachment =
    row.attachment_name !== null &&
    row.attachment_size_bytes !== null &&
    row.attachment_mime_type !== null &&
    row.attachment_storage_path !== null;

  const attachment: MaterialAttachment | null = hasAttachment
    ? {
        name: row.attachment_name ?? '',
        sizeBytes: row.attachment_size_bytes ?? 0,
        mimeType: row.attachment_mime_type ?? 'application/pdf',
        storagePath: row.attachment_storage_path ?? '',
        remoteUrl: options.remoteUrl ?? null,
      }
    : null;

  return {
    id: row.id,
    courseId: row.course_id,
    weekId: row.week_id,
    title: row.title,
    description: row.description,
    externalUrl: row.external_url,
    attachment,
    isAvailableOffline: options.isAvailableOffline ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function localDeadlineToDomain(row: LocalDeadlineRow): Deadline {
  return {
    id: row.id,
    courseId: row.courseId,
    weekId: row.weekId,
    title: row.title,
    description: row.description,
    dueAt: row.dueAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export function domainDeadlineToLocal(deadline: Deadline): LocalDeadlineRow {
  return {
    id: deadline.id,
    courseId: deadline.courseId,
    weekId: deadline.weekId,
    title: deadline.title,
    description: deadline.description,
    dueAt: deadline.dueAt,
    createdAt: deadline.createdAt,
    updatedAt: deadline.updatedAt,
    deletedAt: deadline.deletedAt,
  };
}

export function remoteDeadlineToDomain(row: RemoteDeadlineRow): Deadline {
  return {
    id: row.id,
    courseId: row.course_id,
    weekId: row.week_id,
    title: row.title,
    description: row.description,
    dueAt: row.due_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function localAnnouncementToDomain(
  row: LocalAnnouncementRow,
): Announcement {
  return {
    id: row.id,
    courseId: row.courseId,
    title: row.title,
    body: row.body,
    postedAt: row.postedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export function domainAnnouncementToLocal(
  announcement: Announcement,
): LocalAnnouncementRow {
  return {
    id: announcement.id,
    courseId: announcement.courseId,
    title: announcement.title,
    body: announcement.body,
    postedAt: announcement.postedAt,
    createdAt: announcement.createdAt,
    updatedAt: announcement.updatedAt,
    deletedAt: announcement.deletedAt,
  };
}

export function remoteAnnouncementToDomain(
  row: RemoteAnnouncementRow,
): Announcement {
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    body: row.body,
    postedAt: row.posted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function localNoteToDomain(row: LocalNoteRow): Note {
  return {
    id: row.id,
    userId: row.userId,
    materialId: row.materialId,
    body: row.body,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export function domainNoteToLocal(note: Note): LocalNoteRow {
  return {
    id: note.id,
    userId: note.userId,
    materialId: note.materialId,
    body: note.body,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    deletedAt: note.deletedAt,
  };
}

export function remoteNoteToDomain(row: RemoteNoteRow): Note {
  return {
    id: row.id,
    userId: row.user_id,
    materialId: row.material_id,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}
