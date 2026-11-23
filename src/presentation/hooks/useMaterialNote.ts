import { useCallback, useEffect, useState } from 'react';
import { useAppContainer } from '../../app/di';
import type { Note } from '../../domain/entities';

export interface UseMaterialNoteResult {
  note: Note | null;
  draft: string;
  setDraft: (value: string) => void;
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  saveStatus: 'idle' | 'saved' | 'error';
  error: string | null;
  save: () => Promise<boolean>;
}

export function useMaterialNote(
  userId: string | null,
  materialId: string | undefined,
): UseMaterialNoteResult {
  const container = useAppContainer();
  const [note, setNote] = useState<Note | null>(null);
  const [draft, setDraftState] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>(
    'idle',
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!userId || !materialId) {
      setNote(null);
      setDraftState('');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    void container.usecases.getMaterialNote
      .execute({ userId, materialId })
      .then((loaded) => {
        if (!active) return;
        setNote(loaded);
        setDraftState(loaded?.body ?? '');
        setSaveStatus('idle');
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Could not load private note from local storage.',
        );
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [container, materialId, userId]);

  const setDraft = useCallback((value: string) => {
    setDraftState(value);
    setSaveStatus('idle');
    setError(null);
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    if (!userId || !materialId) {
      return false;
    }
    setIsSaving(true);
    setError(null);
    try {
      const saved = await container.usecases.saveMaterialNote.execute({
        userId,
        materialId,
        body: draft,
      });
      setNote(saved);
      setSaveStatus('saved');
      return true;
    } catch (err) {
      setSaveStatus('error');
      setError(
        err instanceof Error
          ? err.message
          : 'Could not save private note right now.',
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [container, draft, materialId, userId]);

  const isDirty = draft !== (note?.body ?? '');

  return {
    note,
    draft,
    setDraft,
    isLoading,
    isSaving,
    isDirty,
    saveStatus,
    error,
    save,
  };
}
