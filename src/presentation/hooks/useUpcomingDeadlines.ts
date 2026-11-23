import { useCallback, useEffect, useState } from 'react';
import { useAppContainer } from '../../app/di';
import type { UpcomingDeadlinesResultDto } from '../../application/dto';
import { isAppError } from '../../application/errors/AppError';
import { labels } from '../i18n/labels';

export interface UseUpcomingDeadlinesResult {
  result: UpcomingDeadlinesResultDto | null;
  completedIds: ReadonlySet<string>;
  toggleCompleted: (deadlineId: string, completed?: boolean) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useUpcomingDeadlines(
  userId: string | null,
): UseUpcomingDeadlinesResult {
  const container = useAppContainer();
  const [result, setResult] = useState<UpcomingDeadlinesResultDto | null>(null);
  const [completedIds, setCompletedIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const reloadCompletions = useCallback(async (): Promise<void> => {
    if (!userId) {
      setCompletedIds(new Set<string>());
      return;
    }
    const ids = await container.listCompletedDeadlineIds(userId);
    setCompletedIds(new Set(ids));
  }, [container, userId]);

  const reload = useCallback(async (): Promise<void> => {
    if (!userId) {
      setResult(null);
      setCompletedIds(new Set<string>());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [response, doneIds] = await Promise.all([
        container.usecases.getUpcomingDeadlines.execute({ userId }),
        container.listCompletedDeadlineIds(userId),
      ]);
      setResult(response);
      setCompletedIds(new Set(doneIds));
    } catch (err) {
      setError(
        isAppError(err) ? err.message : labels.home.errorTitle,
      );
    } finally {
      setIsLoading(false);
    }
  }, [container, userId]);

  const toggleCompleted = useCallback(
    async (deadlineId: string, completed?: boolean): Promise<boolean> => {
      if (!userId) {
        return false;
      }
      const next = await container.toggleDeadlineCompletion(
        userId,
        deadlineId,
        completed,
      );
      setCompletedIds((prev) => {
        const copy = new Set(prev);
        if (next) {
          copy.add(deadlineId);
        } else {
          copy.delete(deadlineId);
        }
        return copy;
      });
      return next;
    },
    [container, userId],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    return container.subscribeDeadlineCompletions(() => {
      void reloadCompletions();
    });
  }, [container, reloadCompletions]);

  return {
    result,
    completedIds,
    toggleCompleted,
    isLoading,
    error,
    reload,
  };
}
