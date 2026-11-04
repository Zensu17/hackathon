import { useCallback, useEffect, useState } from 'react';
import { useAppContainer } from '../../app/di';
import type { MaterialDetailDto } from '../../application/dto';
import { isAppError } from '../../application/errors/AppError';
import { labels } from '../i18n/labels';

export interface UseMaterialDetailResult {
  detail: MaterialDetailDto | null;
  isLoading: boolean;
  isNotFound: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useMaterialDetail(
  materialId: string | undefined,
): UseMaterialDetailResult {
  const container = useAppContainer();
  const [detail, setDetail] = useState<MaterialDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    if (!materialId) {
      setDetail(null);
      setIsNotFound(true);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setIsNotFound(false);
    setError(null);

    try {
      const result = await container.usecases.getMaterial.execute({
        materialId,
      });
      setDetail(result);
    } catch (err) {
      if (isAppError(err) && err.code === 'NOT_FOUND') {
        setDetail(null);
        setIsNotFound(true);
      } else {
        setError(
          isAppError(err) ? err.message : labels.materialDetail.errorTitle,
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [container, materialId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    detail,
    isLoading,
    isNotFound,
    error,
    reload,
  };
}
