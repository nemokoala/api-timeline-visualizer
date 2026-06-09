const NETWORK_SEARCH_TEXT_KEY = 'api-flow-search-network';
const STORAGE_SEARCH_TEXT_KEY = 'api-flow-search-storage';

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

export function saveNetworkSearchText(value: string): void {
  saveStoredText(NETWORK_SEARCH_TEXT_KEY, value);
}

export function saveStorageSearchText(value: string): void {
  saveStoredText(STORAGE_SEARCH_TEXT_KEY, value);
}
