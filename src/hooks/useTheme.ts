import { useCallback, useEffect, useState } from 'react';
import { applyTheme, setStoredTheme, type ThemeName } from '../utils/themePrefs';

function readAppliedTheme(): ThemeName {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function useTheme(): { theme: ThemeName; toggleTheme: () => void } {
  const [theme, setTheme] = useState<ThemeName>(readAppliedTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readAppliedTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  const toggleTheme = useCallback(() => {
    const next: ThemeName = readAppliedTheme() === 'dark' ? 'light' : 'dark';
    setStoredTheme(next);
    applyTheme(next);
  }, []);

  return { theme, toggleTheme };
}
