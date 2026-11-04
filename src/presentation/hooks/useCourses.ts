import { useCallback, useEffect, useState } from 'react';
import { useAppContainer } from '../../app/di';
import type { CourseListItemDto } from '../../application/dto';
import { isAppError } from '../../application/errors/AppError';
import { labels } from '../i18n/labels';

export interface UseCoursesResult {
  courses: CourseListItemDto[];
  isLoading: boolean;
  error: string | null;
  pendingCourseId: string | null;
  reload: () => Promise<void>;
  toggleFollow: (courseId: string, currentlyFollowed: boolean) => Promise<void>;
}

export function useCourses(
  classId: string | null,
  userId: string | null,
): UseCoursesResult {
  const container = useAppContainer();
  const [courses, setCourses] = useState<CourseListItemDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingCourseId, setPendingCourseId] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    if (!classId || !userId) {
      setCourses([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const items = await container.usecases.listCourses.execute({
        classId,
        userId,
      });
      setCourses(items);
    } catch (err) {
      setError(
        isAppError(err) ? err.message : labels.courses.errorTitle,
      );
    } finally {
      setIsLoading(false);
    }
  }, [classId, container, userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const toggleFollow = useCallback(
    async (courseId: string, currentlyFollowed: boolean): Promise<void> => {
      if (!userId) {
        return;
      }
      setPendingCourseId(courseId);
      setError(null);
      try {
        if (currentlyFollowed) {
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
        if (classId) {
          const updated = await container.usecases.listCourses.execute({
            classId,
            userId,
          });
          setCourses(updated);
        }
      } catch (err) {
        setError(
          isAppError(err) ? err.message : labels.courses.errorTitle,
        );
      } finally {
        setPendingCourseId(null);
      }
    },
    [classId, container, userId],
  );

  return {
    courses,
    isLoading,
    error,
    pendingCourseId,
    reload,
    toggleFollow,
  };
}
