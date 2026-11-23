import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  type ResolvedTheme,
  type ThemePreference,
  useAppContainer,
} from '../../app/di';

export interface UseThemeResult {
  preference: ThemePreference;
  theme: ResolvedTheme;
  setTheme: (nextTheme: ThemePreference) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

function getSystemTheme(): ResolvedTheme {
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }
  return 'light';
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? getSystemTheme() : preference;
}

function applyThemeToDocument(theme: ResolvedTheme): void {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.dataset.theme = theme;
  }
}

const ThemeContext = createContext<UseThemeResult | null>(null);

function useThemeController(): UseThemeResult {
  const container = useAppContainer();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    getSystemTheme(),
  );

  useEffect(() => {
    let active = true;
    const initialResolved = resolveTheme(preference);
    setResolved(initialResolved);
    applyThemeToDocument(initialResolved);

    void container.getThemePreference().then((stored) => {
      if (!active || !stored) {
        return;
      }
      setPreferenceState(stored);
      const nextResolved = resolveTheme(stored);
      setResolved(nextResolved);
      applyThemeToDocument(nextResolved);
    });

    return () => {
      active = false;
    };
  }, [container]);

  useEffect(() => {
    if (
      preference !== 'system' ||
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (): void => {
      const next = mediaQuery.matches ? 'dark' : 'light';
      setResolved(next);
      applyThemeToDocument(next);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [preference]);

  const setTheme = useCallback(
    async (nextTheme: ThemePreference): Promise<void> => {
      setPreferenceState(nextTheme);
      const nextResolved = resolveTheme(nextTheme);
      setResolved(nextResolved);
      applyThemeToDocument(nextResolved);
      await container.setThemePreference(nextTheme);
    },
    [container],
  );

  const toggleTheme = useCallback(async (): Promise<void> => {
    const nextTheme: ThemePreference = resolved === 'dark' ? 'light' : 'dark';
    await setTheme(nextTheme);
  }, [resolved, setTheme]);

  return useMemo(
    () => ({
      preference,
      theme: resolved,
      setTheme,
      toggleTheme,
    }),
    [preference, resolved, setTheme, toggleTheme],
  );
}

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const value = useThemeController();
  return React.createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): UseThemeResult {
  const contextValue = useContext(ThemeContext);
  if (!contextValue) {
    throw new Error('useTheme must be used inside ThemeProvider.');
  }
  return contextValue;
}
