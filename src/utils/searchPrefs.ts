/**
 * 워크스페이스별 검색어와 공통 대소문자 구분 / 전체 단어 일치 토글을 저장합니다.
 * 검색어 기본값은 고정 값이 아닌 빈 문자열입니다.
 */
import { readFlag, readString, writeFlag, writeString } from './localStoragePrefs';

const NETWORK_SEARCH_TEXT_KEY = 'api-flow-search-network';
const STORAGE_SEARCH_TEXT_KEY = 'api-flow-search-storage';
const CONSOLE_SEARCH_TEXT_KEY = 'api-flow-search-console';
const SEARCH_MATCH_CASE_KEY = 'api-flow-search-match-case';
const SEARCH_WHOLE_WORD_KEY = 'api-flow-search-whole-word';

export function getNetworkSearchText(): string {
  return readString(NETWORK_SEARCH_TEXT_KEY) ?? '';
}

export function getStorageSearchText(): string {
  return readString(STORAGE_SEARCH_TEXT_KEY) ?? '';
}

export function getConsoleSearchText(): string {
  return readString(CONSOLE_SEARCH_TEXT_KEY) ?? '';
}

export function saveNetworkSearchText(value: string): void {
  writeString(NETWORK_SEARCH_TEXT_KEY, value);
}

export function saveStorageSearchText(value: string): void {
  writeString(STORAGE_SEARCH_TEXT_KEY, value);
}

export function saveConsoleSearchText(value: string): void {
  writeString(CONSOLE_SEARCH_TEXT_KEY, value);
}

export function getSearchMatchCase(): boolean {
  return readFlag(SEARCH_MATCH_CASE_KEY, false);
}

export function getSearchWholeWord(): boolean {
  return readFlag(SEARCH_WHOLE_WORD_KEY, false);
}

export function saveSearchMatchCase(value: boolean): void {
  writeFlag(SEARCH_MATCH_CASE_KEY, value);
}

export function saveSearchWholeWord(value: boolean): void {
  writeFlag(SEARCH_WHOLE_WORD_KEY, value);
}
