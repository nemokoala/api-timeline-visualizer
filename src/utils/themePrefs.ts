/**
 * 테마 저장 및 적용.
 *
 * 저장된 테마가 있으면 OS 설정보다 우선 적용합니다. 저장된 값이 없으면
 * `prefers-color-scheme`을 따르고, 이후 시스템 변경도 계속 감지합니다.
 */
import { readString, writeString } from './localStoragePrefs';

export type ThemeName = 'light' | 'dark';

const THEME_KEY = 'api-flow-theme';

export function getStoredTheme(): ThemeName | null {
  const stored = readString(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return null;
}

export function setStoredTheme(theme: ThemeName): void {
  writeString(THEME_KEY, theme);
}

/** OS 색상 테마 설정을 반환합니다. */
export function getSystemTheme(): ThemeName {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme;
}

/** 앱 시작 시 테마를 적용하고, OS 테마 변경에 반응합니다. */
export function initTheme(): void {
  applyTheme(getStoredTheme() ?? getSystemTheme());

  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', (event) => {
      if (getStoredTheme()) return;
      applyTheme(event.matches ? 'dark' : 'light');
    });
}
