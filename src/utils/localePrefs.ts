/**
 * 언어 저장 및 초기값 결정.
 *
 * 저장된 언어가 있으면 그것을 쓰고, 없으면 브라우저 언어를 따릅니다
 * (`navigator.language`가 ko로 시작하면 한국어, 아니면 영어).
 * themePrefs와 같은 저장 패턴을 씁니다.
 */
import { readString, writeString } from './localStoragePrefs';

export type Locale = 'ko' | 'en';

const LOCALE_KEY = 'api-flow-locale';

export function getStoredLocale(): Locale | null {
  const stored = readString(LOCALE_KEY);
  if (stored === 'ko' || stored === 'en') return stored;
  return null;
}

export function setStoredLocale(locale: Locale): void {
  writeString(LOCALE_KEY, locale);
}

/** 브라우저 언어를 지원 언어 중 하나로 매핑합니다. */
export function getSystemLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en';
  return navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

/** 앱 시작 시 적용할 언어: 저장값 우선, 없으면 브라우저 언어. */
export function getInitialLocale(): Locale {
  return getStoredLocale() ?? getSystemLocale();
}
