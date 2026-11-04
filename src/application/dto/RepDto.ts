import type { MaterialUploadInput, User } from '../../domain/entities';

export interface CreateCourseInput {
  actor: User;
  classId: string;
  code: string;
  name: string;
  description: string;
}

export interface UpdateCourseInput {
  actor: User;
  courseId: string;
  code: string;
  name: string;
  description: string;
  deletedAt?: string | null;
}

export interface CreateWeekInput {
  actor: User;
  courseId: string;
  weekNumber: number;
  title: string;
  summary: string;
}

export interface UpdateWeekInput {
  actor: User;
  weekId: string;
  weekNumber: number;
  title: string;
  summary: string;
  deletedAt?: string | null;
}

export interface CreateMaterialInput {
  actor: User;
  courseId: string;
  weekId: string;
  title: string;
  description: string;
  externalUrl: string | null;
  file?: MaterialUploadInput | null;
}

export interface UpdateMaterialInput {
  actor: User;
  materialId: string;
  weekId: string;
  title: string;
  description: string;
  externalUrl: string | null;
  file?: MaterialUploadInput | null;
  removeAttachment?: boolean;
  deletedAt?: string | null;
}

export interface CreateDeadlineInput {
  actor: User;
  courseId: string;
  weekId: string | null;
  title: string;
  description: string;
  dueAt: string;
}

export interface UpdateDeadlineInput {
  actor: User;
  deadlineId: string;
  weekId: string | null;
  title: string;
  description: string;
  dueAt: string;
  deletedAt?: string | null;
}

export interface CreateAnnouncementInput {
  actor: User;
  courseId: string;
  title: string;
  body: string;
  postedAt?: string;
}

export interface UpdateAnnouncementInput {
  actor: User;
  announcementId: string;
  title: string;
  body: string;
  postedAt?: string;
  deletedAt?: string | null;
}
