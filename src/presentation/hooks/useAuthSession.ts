import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAppContainer } from '../../app/di';
import type {
  AuthSessionDto,
  SignInInput,
  SignUpInput,
} from '../../application/dto';
import { isAppError } from '../../application/errors/AppError';
import { labels } from '../i18n/labels';

export interface UseAuthSessionResult {
  session: AuthSessionDto | null;
  isLoading: boolean;
  error: string | null;
  isLocalFallbackMode: boolean;
  clearError: () => void;
  refreshSession: () => Promise<AuthSessionDto | null>;
  signIn: (input: SignInInput) => Promise<AuthSessionDto>;
  signUp: (input: SignUpInput) => Promise<AuthSessionDto>;
  signOut: () => Promise<void>;
  joinClass: (joinCode: string) => Promise<AuthSessionDto>;
  createClass: (name: string, joinCode?: string) => Promise<AuthSessionDto>;
  loadSampleSeed: () => Promise<AuthSessionDto>;
}

export function mapAuthError(error: unknown): string {
  if (isAppError(error)) {
    if (error.code === 'INVALID_EMAIL_DOMAIN') {
      return labels.auth.errors.invalidEmailDomain;
    }
    if (error.code === 'AUTH_ERROR') {
      return labels.auth.errors.authFailed;
    }
    if (error.code === 'VALIDATION_ERROR') {
      const msg = error.message.toLowerCase();
      if (msg.includes('full name')) {
        return labels.auth.errors.missingDisplayName;
      }
      if (msg.includes('8 characters')) {
        return labels.auth.errors.shortPassword;
      }
      if (msg.includes('email') || msg.includes('password')) {
        return labels.auth.errors.missingFields;
      }
      return labels.auth.errors.unexpected;
    }
  }
  return labels.auth.errors.unexpected;
}

export function mapOnboardingError(error: unknown): string {
  if (isAppError(error)) {
    if (error.code === 'NOT_FOUND') {
      return labels.joinClass.errors.classNotFound;
    }
    if (error.code === 'DUPLICATE_JOIN_CODE') {
      return labels.joinClass.errors.duplicateJoinCode;
    }
    if (error.code === 'FORBIDDEN_ROLE') {
      return labels.joinClass.errors.seedUnavailable;
    }
    if (error.code === 'VALIDATION_ERROR') {
      const msg = error.message.toLowerCase();
      if (msg.includes('join code is required')) {
        return labels.joinClass.errors.missingJoinCode;
      }
      if (msg.includes('class name')) {
        return labels.joinClass.errors.missingClassName;
      }
      if (msg.includes('3 to 16')) {
        return labels.joinClass.errors.invalidCustomJoinCode;
      }
      return labels.joinClass.errors.unexpected;
    }
  }
  return labels.joinClass.errors.unexpected;
}

const AuthSessionContext = createContext<UseAuthSessionResult | null>(null);

function useAuthSessionState(): UseAuthSessionResult {
  const container = useAppContainer();
  const [session, setSession] = useState<AuthSessionDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSession = useCallback(async (): Promise<AuthSessionDto | null> => {
    const current = await container.usecases.getCurrentUser.execute();
    setSession(current);
    return current;
  }, [container]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    void container.usecases.getCurrentUser
      .execute()
      .then((resolved) => {
        if (active) {
          setSession(resolved);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setSession(null);
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [container]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const signIn = useCallback(
    async (input: SignInInput): Promise<AuthSessionDto> => {
      setError(null);
      try {
        await container.usecases.signIn.execute(input);
        const current = await refreshSession();
        if (!current) {
          throw new Error('Session unavailable after sign-in.');
        }
        return current;
      } catch (err) {
        const message = mapAuthError(err);
        setError(message);
        throw new Error(message);
      }
    },
    [container, refreshSession],
  );

  const signUp = useCallback(
    async (input: SignUpInput): Promise<AuthSessionDto> => {
      setError(null);
      try {
        await container.usecases.signUp.execute(input);
        const current = await refreshSession();
        if (!current) {
          throw new Error('Session unavailable after sign-up.');
        }
        return current;
      } catch (err) {
        const message = mapAuthError(err);
        setError(message);
        throw new Error(message);
      }
    },
    [container, refreshSession],
  );

  const signOut = useCallback(async (): Promise<void> => {
    setError(null);
    await container.usecases.signOut.execute();
    setSession(null);
  }, [container]);

  const joinClass = useCallback(
    async (joinCode: string): Promise<AuthSessionDto> => {
      setError(null);
      if (!session) {
        const message = labels.auth.errors.unexpected;
        setError(message);
        throw new Error(message);
      }
      try {
        await container.usecases.joinClass.execute({
          userId: session.user.id,
          joinCode,
        });
        const current = await refreshSession();
        if (!current) {
          throw new Error('Session unavailable after joining class.');
        }
        return current;
      } catch (err) {
        const message = mapOnboardingError(err);
        setError(message);
        throw new Error(message);
      }
    },
    [container, refreshSession, session],
  );

  const createClass = useCallback(
    async (name: string, joinCode?: string): Promise<AuthSessionDto> => {
      setError(null);
      if (!session) {
        const message = labels.auth.errors.unexpected;
        setError(message);
        throw new Error(message);
      }
      try {
        await container.usecases.createClass.execute({
          userId: session.user.id,
          name,
          joinCode,
        });
        const current = await refreshSession();
        if (!current) {
          throw new Error('Session unavailable after creating class.');
        }
        return current;
      } catch (err) {
        const message = mapOnboardingError(err);
        setError(message);
        throw new Error(message);
      }
    },
    [container, refreshSession, session],
  );

  const loadSampleSeed = useCallback(async (): Promise<AuthSessionDto> => {
    setError(null);
    if (!session) {
      const message = labels.auth.errors.unexpected;
      setError(message);
      throw new Error(message);
    }
    try {
      await container.loadSampleSeedData(session.user.id);
      const current = await refreshSession();
      if (!current) {
        throw new Error('Session unavailable after loading sample data.');
      }
      return current;
    } catch (err) {
      const message = mapOnboardingError(err);
      setError(message);
      throw new Error(message);
    }
  }, [container, refreshSession, session]);

  return useMemo(
    () => ({
      session,
      isLoading,
      error,
      isLocalFallbackMode: container.isLocalFallbackMode,
      clearError,
      refreshSession,
      signIn,
      signUp,
      signOut,
      joinClass,
      createClass,
      loadSampleSeed,
    }),
    [
      session,
      isLoading,
      error,
      container.isLocalFallbackMode,
      clearError,
      refreshSession,
      signIn,
      signUp,
      signOut,
      joinClass,
      createClass,
      loadSampleSeed,
    ],
  );
}

export function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const value = useAuthSessionState();
  return React.createElement(AuthSessionContext.Provider, { value }, children);
}

export function useAuthSession(): UseAuthSessionResult {
  const contextValue = useContext(AuthSessionContext);
  if (!contextValue) {
    throw new Error('useAuthSession must be used inside AuthSessionProvider.');
  }
  return contextValue;
}
