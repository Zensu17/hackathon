import type { Announcement, Course, Deadline, Material, Week } from '../../domain/entities';

export interface GetMaterialNoteInput {
  userId: string;
  materialId: string;
}

export interface SaveMaterialNoteInput {
  userId: string;
  materialId: string;
  body: string;
}

export interface DownloadMaterialFileInput {
  materialId: string;
}

export interface GetOfflineMaterialFileInput {
  materialId: string;
}

export interface RemoveOfflineMaterialFileInput {
  materialId: string;
}

export interface ListRecentAnnouncementsInput {
  userId: string;
  limit?: number;
}

export interface RecentAnnouncementDto {
  announcement: Announcement;
  courseCode: string;
  courseName: string;
}

export interface SearchWorkspaceInput {
  classId: string;
  userId: string;
  query: string;
}

export interface SearchMaterialHitDto {
  material: Material;
  courseCode: string;
  courseName: string;
  weekNumber: number | null;
  weekTitle: string | null;
}

export interface SearchDeadlineHitDto {
  deadline: Deadline;
  courseCode: string;
  courseName: string;
}

export interface SearchAnnouncementHitDto {
  announcement: Announcement;
  courseCode: string;
  courseName: string;
}

export interface WorkspaceSearchResultDto {
  query: string;
  courses: Course[];
  materials: SearchMaterialHitDto[];
  deadlines: SearchDeadlineHitDto[];
  announcements: SearchAnnouncementHitDto[];
  totalCount: number;
}

export interface CourseOfflineSummaryDto {
  courseId: string;
  courseCode: string;
  courseName: string;
  weekCount: number;
  materialCount: number;
  pdfCount: number;
  downloadedPdfCount: number;
  upcomingDeadlineCount: number;
}

export interface OfflineStudyOverviewDto {
  followedCourseCount: number;
  totalMaterials: number;
  totalPdfMaterials: number;
  downloadedPdfCount: number;
  courses: CourseOfflineSummaryDto[];
}

export interface GetOfflineStudyOverviewInput {
  userId: string;
  now?: Date;
}

export interface RunSyncInput {
  userId: string;
  retryFailed?: boolean;
}

export type WeekIndexEntry = Week;
