import { useCallback, useEffect, useState } from 'react';
import { applyTheme, setStoredTheme, type ThemeName } from '../utils/themePrefs';

function readAppliedTheme(): ThemeName {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function useTheme(): {
  theme: ThemeName;
  toggleTheme: () => void;
  setTheme: (next: ThemeName) => void;
} {
  const [theme, setThemeState] = useState<ThemeName>(readAppliedTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => setThemeState(readAppliedTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  const setTheme = useCallback((next: ThemeName) => {
    setStoredTheme(next);
    applyTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(readAppliedTheme() === 'dark' ? 'light' : 'dark');
  }, [setTheme]);

  return { theme, toggleTheme, setTheme };
}
