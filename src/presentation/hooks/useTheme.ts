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

const THEME_STORAGE_KEY = 'litelearn_theme';

function readStoredLocalTheme(): ThemePreference | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'system' || raw === 'light' || raw === 'dark') {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

function writeStoredLocalTheme(preference: ThemePreference): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    }
  } catch {
    // Ignore storage quota or private browsing errors.
  }
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
  if (typeof document === 'undefined' || !document.documentElement) {
    return;
  }
  document.documentElement.dataset.theme = theme;
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  const color = theme === 'dark' ? '#121212' : '#FFFFFF';
  metas.forEach((meta) => {
    meta.setAttribute('content', color);
  });
}

const ThemeContext = createContext<UseThemeResult | null>(null);

function useThemeController(): UseThemeResult {
  const container = useAppContainer();
  const [preference, setPreferenceState] = useState<ThemePreference>(
    () => readStoredLocalTheme() ?? 'system',
  );
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolveTheme(readStoredLocalTheme() ?? 'system'),
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
      writeStoredLocalTheme(stored);
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
      writeStoredLocalTheme(nextTheme);
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
