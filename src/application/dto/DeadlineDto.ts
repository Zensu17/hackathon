import type { Deadline } from '../../domain/entities';

export interface GetUpcomingDeadlinesInput {
  userId: string;
}

export interface UpcomingDeadlineDto extends Deadline {
  courseCode: string;
  courseName: string;
  isOverdue: boolean;
  isDueSoon: boolean;
}

export interface UpcomingDeadlinesResultDto {
  followedCourseCount: number;
  items: UpcomingDeadlineDto[];
}
