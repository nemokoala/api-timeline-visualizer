/**
 * 경량 i18n — 라이브러리 없이 Context + t() 만으로 한국어/영어를 전환한다.
 *
 * - 언어별 메시지는 ko.ts(원본)와 en.ts에 평면 키로 둔다.
 * - `t(key, vars)`로 조회하고, 값 안의 `{var}`는 vars로 치환한다.
 * - 언어는 localStorage에 저장하고(localePrefs), 없으면 브라우저 언어를 따른다.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getInitialLocale,
  setStoredLocale,
  type Locale,
} from '../utils/localePrefs';
import { ko, type MessageKey } from './ko';
import { en } from './en';

export type { Locale } from '../utils/localePrefs';
export type { MessageKey } from './ko';

const MESSAGES: Record<Locale, Record<MessageKey, string>> = { ko, en };

export type TranslateVars = Record<string, string | number>;
export type TranslateFn = (key: MessageKey, vars?: TranslateVars) => string;

/** `{var}` 자리표시자를 vars 값으로 치환한다. 매칭되는 값이 없으면 원문 그대로 둔다. */
export function formatMessage(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslateFn;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setStoredLocale(next);
    setLocaleState(next);
  }, []);

  const t = useCallback<TranslateFn>(
    (key, vars) => {
      const dict = MESSAGES[locale];
      // 누락 키가 있어도 앱이 죽지 않게 ko → key 순으로 폴백한다.
      const template = dict[key] ?? ko[key] ?? key;
      return formatMessage(template, vars);
    },
    [locale],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) {
    throw new Error('useLocale는 <LocaleProvider> 안에서만 쓸 수 있습니다.');
  }
  return value;
}

/** 번역 함수만 필요한 대부분의 컴포넌트용 축약 훅. */
export function useT(): TranslateFn {
  return useLocale().t;
}
