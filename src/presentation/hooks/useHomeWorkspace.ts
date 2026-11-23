import { useCallback, useEffect, useState } from 'react';
import { useAppContainer } from '../../app/di';
import type {
  OfflineStudyOverviewDto,
  RecentAnnouncementDto,
} from '../../application/dto';

export interface UseHomeWorkspaceResult {
  announcements: RecentAnnouncementDto[];
  overview: OfflineStudyOverviewDto | null;
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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    if (!userId) {
      setAnnouncements([]);
      setOverview(null);
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
    isLoading,
    error,
    reload,
  };
}
