import type { Week } from '../entities/Week';

export interface CreateWeekRecordInput {
  courseId: string;
  weekNumber: number;
  title: string;
  summary: string;
}

export interface UpdateWeekRecordInput {
  weekNumber: number;
  title: string;
  summary: string;
  deletedAt?: string | null;
}

export interface WeekRepository {
  listByCourseId(courseId: string): Promise<Week[]>;
  getById(id: string): Promise<Week | null>;
  create(input: CreateWeekRecordInput): Promise<Week>;
  update(id: string, input: UpdateWeekRecordInput): Promise<Week>;
}
