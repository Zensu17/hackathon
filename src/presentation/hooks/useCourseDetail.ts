import { useCallback, useEffect, useState } from 'react';
import { useAppContainer } from '../../app/di';
import type { CourseWeeksDto } from '../../application/dto';
import { isAppError } from '../../application/errors/AppError';
import type { Announcement } from '../../domain/entities';
import { labels } from '../i18n/labels';

export interface UseCourseDetailResult {
  courseWeeks: CourseWeeksDto | null;
  announcements: Announcement[];
  isLoading: boolean;
  isNotFound: boolean;
  error: string | null;
  isTogglingFollow: boolean;
  reload: () => Promise<void>;
  toggleFollow: () => Promise<void>;
}

export function useCourseDetail(
  courseId: string | undefined,
  userId: string | null,
): UseCourseDetailResult {
  const container = useAppContainer();
  const [courseWeeks, setCourseWeeks] = useState<CourseWeeksDto | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isTogglingFollow, setIsTogglingFollow] = useState<boolean>(false);

  const reload = useCallback(async (): Promise<void> => {
    if (!courseId) {
      setCourseWeeks(null);
      setAnnouncements([]);
      setIsNotFound(true);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setIsNotFound(false);
    setError(null);

    try {
      const [weeksDto, announcementItems] = await Promise.all([
        container.usecases.getCourseWeeks.execute({
          courseId,
          userId: userId ?? undefined,
        }),
        container.usecases.listAnnouncements.execute({ courseId }),
      ]);
      setCourseWeeks(weeksDto);
      setAnnouncements(announcementItems);
    } catch (err) {
      if (isAppError(err) && err.code === 'NOT_FOUND') {
        setCourseWeeks(null);
        setAnnouncements([]);
        setIsNotFound(true);
      } else {
        setError(
          isAppError(err) ? err.message : labels.courseDetail.errorTitle,
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [container, courseId, userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const toggleFollow = useCallback(async (): Promise<void> => {
    if (!courseId || !userId || !courseWeeks) {
      return;
    }
    setIsTogglingFollow(true);
    setError(null);
    try {
      if (courseWeeks.isFollowed) {
        await container.usecases.unfollowCourse.execute({
          userId,
          courseId,
        });
      } else {
        await container.usecases.followCourse.execute({
          userId,
          courseId,
        });
      }
      const [weeksDto, announcementItems] = await Promise.all([
        container.usecases.getCourseWeeks.execute({
          courseId,
          userId,
        }),
        container.usecases.listAnnouncements.execute({ courseId }),
      ]);
      setCourseWeeks(weeksDto);
      setAnnouncements(announcementItems);
    } catch (err) {
      setError(
        isAppError(err) ? err.message : labels.courseDetail.errorTitle,
      );
    } finally {
      setIsTogglingFollow(false);
    }
  }, [container, courseId, courseWeeks, userId]);

  return {
    courseWeeks,
    announcements,
    isLoading,
    isNotFound,
    error,
    isTogglingFollow,
    reload,
    toggleFollow,
  };
}
