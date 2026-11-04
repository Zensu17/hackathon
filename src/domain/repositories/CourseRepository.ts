import type { Course } from '../entities/Course';
import type { CourseFollow } from '../entities/CourseFollow';

export interface CreateCourseRecordInput {
  classId: string;
  code: string;
  name: string;
  description: string;
}

export interface UpdateCourseRecordInput {
  code: string;
  name: string;
  description: string;
  deletedAt?: string | null;
}

export interface CourseRepository {
  listByClassId(classId: string): Promise<Course[]>;
  getById(id: string): Promise<Course | null>;
  listFollowedCourseIds(userId: string): Promise<string[]>;
  followCourse(userId: string, courseId: string): Promise<CourseFollow>;
  unfollowCourse(userId: string, courseId: string): Promise<void>;
  create(input: CreateCourseRecordInput): Promise<Course>;
  update(id: string, input: UpdateCourseRecordInput): Promise<Course>;
}
