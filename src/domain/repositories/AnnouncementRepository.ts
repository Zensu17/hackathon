import type { Announcement } from '../entities/Announcement';

export interface CreateAnnouncementRecordInput {
  courseId: string;
  title: string;
  body: string;
  postedAt?: string;
}

export interface UpdateAnnouncementRecordInput {
  title: string;
  body: string;
  postedAt?: string;
  deletedAt?: string | null;
}

export interface AnnouncementRepository {
  listByCourseId(courseId: string): Promise<Announcement[]>;
  getById(id: string): Promise<Announcement | null>;
  create(input: CreateAnnouncementRecordInput): Promise<Announcement>;
  update(id: string, input: UpdateAnnouncementRecordInput): Promise<Announcement>;
}
