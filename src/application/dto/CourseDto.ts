import type { Course } from '../../domain/entities';

export interface ListCoursesInput {
  classId: string;
  userId: string;
}

export interface CourseListItemDto extends Course {
  isFollowed: boolean;
}

export interface FollowCourseInput {
  userId: string;
  courseId: string;
}

export interface UnfollowCourseInput {
  userId: string;
  courseId: string;
}
