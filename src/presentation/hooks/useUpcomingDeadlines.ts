import { useCallback, useEffect, useState } from 'react';
import { useAppContainer } from '../../app/di';
import type { UpcomingDeadlinesResultDto } from '../../application/dto';
import { isAppError } from '../../application/errors/AppError';
import { labels } from '../i18n/labels';

export interface UseUpcomingDeadlinesResult {
  result: UpcomingDeadlinesResultDto | null;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useUpcomingDeadlines(
  userId: string | null,
): UseUpcomingDeadlinesResult {
  const container = useAppContainer();
  const [result, setResult] = useState<UpcomingDeadlinesResultDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    if (!userId) {
      setResult(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await container.usecases.getUpcomingDeadlines.execute({
        userId,
      });
      setResult(response);
    } catch (err) {
      setError(
        isAppError(err) ? err.message : labels.home.errorTitle,
      );
    } finally {
      setIsLoading(false);
    }
  }, [container, userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    result,
    isLoading,
    error,
    reload,
  };
}
