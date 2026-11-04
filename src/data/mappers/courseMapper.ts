import type { Course, CourseFollow } from '../../domain/entities';
import type {
  LocalCourseFollowRow,
  LocalCourseRow,
} from '../local/LiteLearnDb';

export interface RemoteCourseRow {
  id: string;
  class_id: string;
  code: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RemoteCourseFollowRow {
  id: string;
  user_id: string;
  course_id: string;
  created_at: string;
}

export function localCourseToDomain(row: LocalCourseRow): Course {
  return {
    id: row.id,
    classId: row.classId,
    code: row.code,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export function domainCourseToLocal(course: Course): LocalCourseRow {
  return {
    id: course.id,
    classId: course.classId,
    code: course.code,
    name: course.name,
    description: course.description,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
    deletedAt: course.deletedAt,
  };
}

export function remoteCourseToDomain(row: RemoteCourseRow): Course {
  return {
    id: row.id,
    classId: row.class_id,
    code: row.code,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function localCourseFollowToDomain(
  row: LocalCourseFollowRow,
): CourseFollow {
  return {
    id: row.id,
    userId: row.userId,
    courseId: row.courseId,
    createdAt: row.createdAt,
  };
}

export function domainCourseFollowToLocal(
  follow: CourseFollow,
): LocalCourseFollowRow {
  return {
    id: follow.id,
    userId: follow.userId,
    courseId: follow.courseId,
    createdAt: follow.createdAt,
  };
}

export function remoteCourseFollowToDomain(
  row: RemoteCourseFollowRow,
): CourseFollow {
  return {
    id: row.id,
    userId: row.user_id,
    courseId: row.course_id,
    createdAt: row.created_at,
  };
}
