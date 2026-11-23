import { useCallback, useEffect, useState } from 'react';
import { useAppContainer } from '../../app/di';
import type { MaterialDetailDto } from '../../application/dto';
import { isAppError } from '../../application/errors/AppError';
import { labels } from '../i18n/labels';

export interface AdjacentMaterialLink {
  id: string;
  title: string;
  weekNumber: number;
}

export interface UseMaterialDetailResult {
  detail: MaterialDetailDto | null;
  prevMaterial: AdjacentMaterialLink | null;
  nextMaterial: AdjacentMaterialLink | null;
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
  const [prevMaterial, setPrevMaterial] = useState<AdjacentMaterialLink | null>(
    null,
  );
  const [nextMaterial, setNextMaterial] = useState<AdjacentMaterialLink | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    if (!materialId) {
      setDetail(null);
      setPrevMaterial(null);
      setNextMaterial(null);
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

      try {
        const courseWeeks = await container.usecases.getCourseWeeks.execute({
          courseId: result.course.id,
        });
        const ordered: AdjacentMaterialLink[] = [];
        for (const w of courseWeeks.weeks) {
          for (const m of w.materials) {
            ordered.push({
              id: m.id,
              title: m.title,
              weekNumber: w.weekNumber,
            });
          }
        }
        const currentIdx = ordered.findIndex((item) => item.id === materialId);
        setPrevMaterial(
          currentIdx > 0 ? (ordered[currentIdx - 1] ?? null) : null,
        );
        setNextMaterial(
          currentIdx >= 0 && currentIdx + 1 < ordered.length
            ? (ordered[currentIdx + 1] ?? null)
            : null,
        );
      } catch {
        setPrevMaterial(null);
        setNextMaterial(null);
      }
    } catch (err) {
      if (isAppError(err) && err.code === 'NOT_FOUND') {
        setDetail(null);
        setPrevMaterial(null);
        setNextMaterial(null);
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
    prevMaterial,
    nextMaterial,
    isLoading,
    isNotFound,
    error,
    reload,
  };
}
