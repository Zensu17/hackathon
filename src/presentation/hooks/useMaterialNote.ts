import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppContainer } from '../../app/di';
import type { Note } from '../../domain/entities';

const AUTO_SAVE_DEBOUNCE_MS = 750;

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

  const activeTargetRef = useRef<{
    userId: string | null;
    materialId: string | undefined;
  }>({ userId, materialId });
  const latestDraftRef = useRef<{
    userId: string | null;
    materialId: string | undefined;
    draft: string;
    isDirty: boolean;
  }>({
    userId,
    materialId,
    draft: '',
    isDirty: false,
  });
  const saveSeqRef = useRef<number>(0);
  const isSavingRef = useRef<boolean>(false);

  const isDirty = draft !== (note?.body ?? '');

  latestDraftRef.current = {
    userId,
    materialId,
    draft,
    isDirty,
  };

  // Flush dirty note draft when switching materials or unmounting, and reset state immediately to prevent cross-material leakage.
  useEffect(() => {
    const prev = activeTargetRef.current;
    const prevSnapshot = latestDraftRef.current;
    if (
      prevSnapshot.isDirty &&
      prev.userId &&
      prev.materialId &&
      (prev.userId !== userId || prev.materialId !== materialId)
    ) {
      void container.usecases.saveMaterialNote
        .execute({
          userId: prev.userId,
          materialId: prev.materialId,
          body: prevSnapshot.draft,
        })
        .catch(() => undefined);
    }

    activeTargetRef.current = { userId, materialId };
    saveSeqRef.current += 1;
    isSavingRef.current = false;

    let active = true;
    setNote(null);
    setDraftState('');
    setSaveStatus('idle');
    setError(null);
    setIsSaving(false);

    if (!userId || !materialId) {
      setIsLoading(false);
      return undefined;
    }

    setIsLoading(true);
    void container.usecases.getMaterialNote
      .execute({ userId, materialId })
      .then((loaded) => {
        if (!active) return;
        setNote(loaded);
        setDraftState(loaded?.body ?? '');
        setSaveStatus(loaded ? 'saved' : 'idle');
      })
      .catch((err: unknown) => {
        if (!active) return;
        setNote(null);
        setDraftState('');
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

  // Flush any remaining dirty draft when the component unmounts cleanly.
  useEffect(() => {
    return () => {
      const snapshot = latestDraftRef.current;
      if (snapshot.isDirty && snapshot.userId && snapshot.materialId) {
        void container.usecases.saveMaterialNote
          .execute({
            userId: snapshot.userId,
            materialId: snapshot.materialId,
            body: snapshot.draft,
          })
          .catch(() => undefined);
      }
    };
  }, [container]);

  const setDraft = useCallback((value: string) => {
    setDraftState(value);
    setSaveStatus('idle');
    setError(null);
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    const targetUserId = userId;
    const targetMaterialId = materialId;
    if (!targetUserId || !targetMaterialId || isSavingRef.current) {
      return false;
    }

    const seq = ++saveSeqRef.current;
    isSavingRef.current = true;
    setIsSaving(true);
    setError(null);
    try {
      const saved = await container.usecases.saveMaterialNote.execute({
        userId: targetUserId,
        materialId: targetMaterialId,
        body: draft,
      });
      const current = activeTargetRef.current;
      if (
        current.userId === targetUserId &&
        current.materialId === targetMaterialId &&
        seq === saveSeqRef.current
      ) {
        setNote(saved);
        setSaveStatus('saved');
      }
      return true;
    } catch (err) {
      const current = activeTargetRef.current;
      if (
        current.userId === targetUserId &&
        current.materialId === targetMaterialId &&
        seq === saveSeqRef.current
      ) {
        setSaveStatus('error');
        setError(
          err instanceof Error
            ? err.message
            : 'Could not save private note right now.',
        );
      }
      return false;
    } finally {
      const current = activeTargetRef.current;
      if (
        current.userId === targetUserId &&
        current.materialId === targetMaterialId &&
        seq === saveSeqRef.current
      ) {
        isSavingRef.current = false;
        setIsSaving(false);
      }
    }
  }, [container, draft, materialId, userId]);

  // Debounced auto-save so students never lose notes while studying offline.
  useEffect(() => {
    if (isLoading || !isDirty || !userId || !materialId) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      void save();
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [draft, isDirty, isLoading, materialId, save, userId]);

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
