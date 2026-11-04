import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { type ThemePreference, useAppContainer } from '../../app/di';

export interface UseThemeResult {
  theme: ThemePreference;
  setTheme: (nextTheme: ThemePreference) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

function detectInitialTheme(): ThemePreference {
  if (typeof document !== 'undefined' && document.documentElement) {
    const existing = document.documentElement.dataset.theme;
    if (existing === 'light' || existing === 'dark') {
      return existing;
    }
  }
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }
  return 'light';
}

function applyThemeToDocument(theme: ThemePreference): void {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.dataset.theme = theme;
  }
}

const ThemeContext = createContext<UseThemeResult | null>(null);

function useStandaloneTheme(): UseThemeResult {
  const container = useAppContainer();
  const [theme, setThemeState] = useState<ThemePreference>(() => detectInitialTheme());

  useEffect(() => {
    let active = true;
    applyThemeToDocument(theme);

    void container.getThemePreference().then((stored) => {
      if (!active) {
        return;
      }
      if (stored === 'light' || stored === 'dark') {
        setThemeState(stored);
        applyThemeToDocument(stored);
      }
    });

    return () => {
      active = false;
    };
  }, [container]);

  const setTheme = useCallback(
    async (nextTheme: ThemePreference): Promise<void> => {
      setThemeState(nextTheme);
      applyThemeToDocument(nextTheme);
      await container.setThemePreference(nextTheme);
    },
    [container],
  );

  const toggleTheme = useCallback(async (): Promise<void> => {
    const nextTheme: ThemePreference = theme === 'dark' ? 'light' : 'dark';
    await setTheme(nextTheme);
  }, [setTheme, theme]);

  return useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme],
  );
}

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const value = useStandaloneTheme();
  return React.createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): UseThemeResult {
  const contextValue = useContext(ThemeContext);
  const standalone = useStandaloneTheme();
  return contextValue ?? standalone;
}
