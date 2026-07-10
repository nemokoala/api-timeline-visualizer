/**
 * 콘솔 로그 레벨 구조화 필터.
 *
 * Include/Exclude 텍스트 필터(노이즈 제거)와 별개로, 레벨로 행을 거른다.
 * 네트워크의 상태/메서드 필터와 같은 규칙이다 — 다중 선택이고 localStorage에
 * 저장하며, 빈 배열은 "모두 끔"으로 존중한다.
 *
 * `clear`는 필터 항목이 아니다. console.clear() 표식일 뿐이라 목록에서 항상 제외된다.
 */
import type { ConsoleEntry, ConsoleLevel } from '../types/console';
import { readJson, writeJson } from './localStoragePrefs';

export const FILTERABLE_CONSOLE_LEVELS = [
  'log',
  'info',
  'warn',
  'error',
  'debug',
  'table',
  'dir',
] as const;

export type FilterableConsoleLevel = (typeof FILTERABLE_CONSOLE_LEVELS)[number];

export const CONSOLE_LEVEL_LABELS: Record<FilterableConsoleLevel, string> = {
  log: 'Log',
  info: 'Info',
  warn: 'Warn',
  error: 'Error',
  debug: 'Debug',
  table: 'Table',
  dir: 'Dir',
};

const CONSOLE_LEVELS_KEY = 'api-flow-console-levels';

export function getEnabledConsoleLevels(): FilterableConsoleLevel[] {
  const stored = readJson<unknown>(CONSOLE_LEVELS_KEY);
  // 저장된 값이 없으면(첫 실행) 전체 활성, 빈 배열이면 "모두 끔"으로 존중한다.
  if (!Array.isArray(stored)) return [...FILTERABLE_CONSOLE_LEVELS];
  return FILTERABLE_CONSOLE_LEVELS.filter((level) => stored.includes(level));
}

export function saveEnabledConsoleLevels(levels: FilterableConsoleLevel[]): void {
  writeJson(CONSOLE_LEVELS_KEY, levels);
}

/** 필터 항목에 없는 레벨(clear)이면 null. */
export function toFilterableConsoleLevel(level: ConsoleLevel): FilterableConsoleLevel | null {
  return (FILTERABLE_CONSOLE_LEVELS as readonly string[]).includes(level)
    ? (level as FilterableConsoleLevel)
    : null;
}

export function matchesConsoleLevelFilter(
  entry: ConsoleEntry,
  enabledLevels: FilterableConsoleLevel[],
): boolean {
  // 전체 활성이면 목록 밖 레벨도 통과시킨다(네트워크 상태 필터와 동일한 규칙).
  if (enabledLevels.length === FILTERABLE_CONSOLE_LEVELS.length) return true;
  const level = toFilterableConsoleLevel(entry.level);
  return level !== null && enabledLevels.includes(level);
}
