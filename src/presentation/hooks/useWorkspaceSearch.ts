import { useCallback, useEffect, useState } from 'react';
import { useAppContainer } from '../../app/di';
import type { WorkspaceSearchResultDto } from '../../application/dto';

export interface UseWorkspaceSearchResult {
  query: string;
  setQuery: (next: string) => void;
  clear: () => void;
  result: WorkspaceSearchResultDto | null;
  isSearching: boolean;
  error: string | null;
}

export function useWorkspaceSearch(
  classId: string | null,
  userId: string | null,
): UseWorkspaceSearchResult {
  const container = useAppContainer();
  const [query, setQuery] = useState<string>('');
  const [result, setResult] = useState<WorkspaceSearchResultDto | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!classId || !userId || trimmed.length === 0) {
      setResult(null);
      setIsSearching(false);
      setError(null);
      return;
    }

    let active = true;
    setIsSearching(true);
    setError(null);

    const timer = window.setTimeout(() => {
      void container.usecases.searchWorkspace
        .execute({ classId, userId, query: trimmed })
        .then((res) => {
          if (active) {
            setResult(res);
          }
        })
        .catch((err: unknown) => {
          if (active) {
            setError(
              err instanceof Error
                ? err.message
                : 'Search failed while reading local storage.',
            );
          }
        })
        .finally(() => {
          if (active) {
            setIsSearching(false);
          }
        });
    }, 140);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [classId, container, query, userId]);

  const clear = useCallback(() => {
    setQuery('');
    setResult(null);
    setError(null);
  }, []);

  return {
    query,
    setQuery,
    clear,
    result,
    isSearching,
    error,
  };
}
