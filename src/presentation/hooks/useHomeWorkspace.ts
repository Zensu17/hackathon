import { useCallback, useEffect, useState } from 'react';
import { useAppContainer } from '../../app/di';
import type {
  OfflineStudyOverviewDto,
  RecentAnnouncementDto,
} from '../../application/dto';

export interface StudyShelfMaterialItem {
  id: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  weekNumber: number;
  title: string;
  hasPdf: boolean;
  pdfSizeBytes: number | null;
  isAvailableOffline: boolean;
}

export interface UseHomeWorkspaceResult {
  announcements: RecentAnnouncementDto[];
  overview: OfflineStudyOverviewDto | null;
  studyShelf: StudyShelfMaterialItem[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useHomeWorkspace(
  userId: string | null,
): UseHomeWorkspaceResult {
  const container = useAppContainer();
  const [announcements, setAnnouncements] = useState<RecentAnnouncementDto[]>(
    [],
  );
  const [overview, setOverview] = useState<OfflineStudyOverviewDto | null>(
    null,
  );
  const [studyShelf, setStudyShelf] = useState<StudyShelfMaterialItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    if (!userId) {
      setAnnouncements([]);
      setOverview(null);
      setStudyShelf([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [recentAnnouncements, studyOverview] = await Promise.all([
        container.usecases.listRecentAnnouncements.execute({
          userId,
          limit: 4,
        }),
        container.usecases.getOfflineStudyOverview.execute({ userId }),
      ]);
      setAnnouncements(recentAnnouncements);
      setOverview(studyOverview);

      const courseSummaries = studyOverview.courses.slice(0, 4);
      const weeksSnapshots = await Promise.all(
        courseSummaries.map((c) =>
          container.usecases.getCourseWeeks
            .execute({ courseId: c.courseId, userId })
            .catch(() => null),
        ),
      );

      const shelfItems: StudyShelfMaterialItem[] = [];
      for (const snap of weeksSnapshots) {
        if (!snap) continue;
        for (const week of snap.weeks) {
          for (const mat of week.materials) {
            shelfItems.push({
              id: mat.id,
              courseId: snap.course.id,
              courseCode: snap.course.code,
              courseName: snap.course.name,
              weekNumber: week.weekNumber,
              title: mat.title,
              hasPdf: mat.attachment !== null,
              pdfSizeBytes: mat.attachment?.sizeBytes ?? null,
              isAvailableOffline: mat.isAvailableOffline,
            });
          }
        }
      }

      shelfItems.sort((a, b) => {
        if (a.isAvailableOffline !== b.isAvailableOffline) {
          return a.isAvailableOffline ? -1 : 1;
        }
        if (a.hasPdf !== b.hasPdf) {
          return a.hasPdf ? -1 : 1;
        }
        return b.weekNumber - a.weekNumber;
      });

      setStudyShelf(shelfItems.slice(0, 4));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not read study overview from local storage.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [container, userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    announcements,
    overview,
    studyShelf,
    isLoading,
    error,
    reload,
  };
}
