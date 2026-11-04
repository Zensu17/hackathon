import type { Deadline } from '../entities/Deadline';

export interface CreateDeadlineRecordInput {
  courseId: string;
  weekId: string | null;
  title: string;
  description: string;
  dueAt: string;
}

export interface UpdateDeadlineRecordInput {
  weekId: string | null;
  title: string;
  description: string;
  dueAt: string;
  deletedAt?: string | null;
}

export interface DeadlineRepository {
  listByCourseIds(courseIds: readonly string[]): Promise<Deadline[]>;
  listByCourseId(courseId: string): Promise<Deadline[]>;
  getById(id: string): Promise<Deadline | null>;
  create(input: CreateDeadlineRecordInput): Promise<Deadline>;
  update(id: string, input: UpdateDeadlineRecordInput): Promise<Deadline>;
}
