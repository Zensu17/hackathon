import type {
  Course,
  Deadline,
  Material,
  Week,
} from '../../domain/entities';

export interface GetCourseWeeksInput {
  courseId: string;
  userId?: string;
}

export interface AnnotatedDeadlineDto extends Deadline {
  isOverdue: boolean;
  isDueSoon: boolean;
}

export interface WeekWithContentDto extends Week {
  materials: Material[];
  deadlines: AnnotatedDeadlineDto[];
}

export interface CourseWeeksDto {
  course: Course;
  isFollowed: boolean;
  weeks: WeekWithContentDto[];
  unassignedDeadlines: AnnotatedDeadlineDto[];
}

export interface GetMaterialInput {
  materialId: string;
}

export interface MaterialDetailDto {
  material: Material;
  course: Course;
  week: Week;
}

export interface ListAnnouncementsInput {
  courseId: string;
}
