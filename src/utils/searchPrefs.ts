const NETWORK_SEARCH_TEXT_KEY = 'api-flow-search-network';
const STORAGE_SEARCH_TEXT_KEY = 'api-flow-search-storage';
const CONSOLE_SEARCH_TEXT_KEY = 'api-flow-search-console';
const SEARCH_MATCH_CASE_KEY = 'api-flow-search-match-case';
const SEARCH_WHOLE_WORD_KEY = 'api-flow-search-whole-word';

function readStoredText(key: string): string {
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) return stored;
  } catch {
    // Ignore storage errors.
  }

  return '';
}

function saveStoredText(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors.
  }
}

export function getNetworkSearchText(): string {
  return readStoredText(NETWORK_SEARCH_TEXT_KEY);
}

export function getStorageSearchText(): string {
  return readStoredText(STORAGE_SEARCH_TEXT_KEY);
}

export function getConsoleSearchText(): string {
  return readStoredText(CONSOLE_SEARCH_TEXT_KEY);
}

export function saveNetworkSearchText(value: string): void {
  saveStoredText(NETWORK_SEARCH_TEXT_KEY, value);
}

export function saveStorageSearchText(value: string): void {
  saveStoredText(STORAGE_SEARCH_TEXT_KEY, value);
}

export function saveConsoleSearchText(value: string): void {
  saveStoredText(CONSOLE_SEARCH_TEXT_KEY, value);
}

function readStoredFlag(key: string, defaultValue: boolean): boolean {
  try {
    const stored = localStorage.getItem(key);
    if (stored === 'false') return false;
    if (stored === 'true') return true;
  } catch {
    // Ignore storage errors.
  }

  return defaultValue;
}

function saveStoredFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Ignore storage errors.
  }
}

export function getSearchMatchCase(): boolean {
  return readStoredFlag(SEARCH_MATCH_CASE_KEY, false);
}

export function getSearchWholeWord(): boolean {
  return readStoredFlag(SEARCH_WHOLE_WORD_KEY, false);
}

export function saveSearchMatchCase(value: boolean): void {
  saveStoredFlag(SEARCH_MATCH_CASE_KEY, value);
}

export function saveSearchWholeWord(value: boolean): void {
  saveStoredFlag(SEARCH_WHOLE_WORD_KEY, value);
}
