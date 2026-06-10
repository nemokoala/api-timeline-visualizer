export type ThemeName = 'light' | 'dark';

const THEME_KEY = 'api-flow-theme';

export function getStoredTheme(): ThemeName | null {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Ignore storage errors.
  }

  return null;
}

export function setStoredTheme(theme: ThemeName): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore storage errors.
  }
}

export function getSystemTheme(): ThemeName {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme;
}

export function initTheme(): void {
  applyTheme(getStoredTheme() ?? getSystemTheme());

  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', (event) => {
      if (getStoredTheme()) return;
      applyTheme(event.matches ? 'dark' : 'light');
    });
}
