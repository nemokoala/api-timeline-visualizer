const LEGACY_INCLUDE_TEXT_KEY = 'api-flow-filter-include';
const LEGACY_EXCLUDE_TEXT_KEY = 'api-flow-filter-exclude';

const NETWORK_INCLUDE_TEXT_KEY = 'api-flow-filter-network-include';
const NETWORK_EXCLUDE_TEXT_KEY = 'api-flow-filter-network-exclude';
const STORAGE_INCLUDE_TEXT_KEY = 'api-flow-filter-storage-include';
const STORAGE_EXCLUDE_TEXT_KEY = 'api-flow-filter-storage-exclude';
const CONSOLE_INCLUDE_TEXT_KEY = 'api-flow-filter-console-include';
const CONSOLE_EXCLUDE_TEXT_KEY = 'api-flow-filter-console-exclude';

export const DEFAULT_NETWORK_INCLUDE_TEXT = 'api';
export const DEFAULT_NETWORK_EXCLUDE_TEXT =
  'google-analytics,sentry,datadog,amplitude,hotjar,segment';
export const DEFAULT_STORAGE_INCLUDE_TEXT = '';
export const DEFAULT_STORAGE_EXCLUDE_TEXT =
  'google-analytics,sentry,datadog,amplitude,hotjar,segment';
export const DEFAULT_CONSOLE_INCLUDE_TEXT = '';
export const DEFAULT_CONSOLE_EXCLUDE_TEXT = '';

function readStoredText(key: string, legacyKey: string | null, defaultValue: string): string {
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) return stored;

    if (legacyKey) {
      const legacy = localStorage.getItem(legacyKey);
      if (legacy !== null) return legacy;
    }
  } catch {
    // Ignore storage errors.
  }

  return defaultValue;
}

function saveStoredText(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors.
  }
}

export function getNetworkIncludeText(defaultValue = DEFAULT_NETWORK_INCLUDE_TEXT): string {
  return readStoredText(NETWORK_INCLUDE_TEXT_KEY, LEGACY_INCLUDE_TEXT_KEY, defaultValue);
}

export function getNetworkExcludeText(defaultValue = DEFAULT_NETWORK_EXCLUDE_TEXT): string {
  return readStoredText(NETWORK_EXCLUDE_TEXT_KEY, LEGACY_EXCLUDE_TEXT_KEY, defaultValue);
}

export function getStorageIncludeText(defaultValue = DEFAULT_STORAGE_INCLUDE_TEXT): string {
  return readStoredText(STORAGE_INCLUDE_TEXT_KEY, null, defaultValue);
}

export function getStorageExcludeText(defaultValue = DEFAULT_STORAGE_EXCLUDE_TEXT): string {
  return readStoredText(STORAGE_EXCLUDE_TEXT_KEY, null, defaultValue);
}

export function saveNetworkIncludeText(value: string): void {
  saveStoredText(NETWORK_INCLUDE_TEXT_KEY, value);
}

export function saveNetworkExcludeText(value: string): void {
  saveStoredText(NETWORK_EXCLUDE_TEXT_KEY, value);
}

export function saveStorageIncludeText(value: string): void {
  saveStoredText(STORAGE_INCLUDE_TEXT_KEY, value);
}

export function saveStorageExcludeText(value: string): void {
  saveStoredText(STORAGE_EXCLUDE_TEXT_KEY, value);
}

export function getConsoleIncludeText(defaultValue = DEFAULT_CONSOLE_INCLUDE_TEXT): string {
  return readStoredText(CONSOLE_INCLUDE_TEXT_KEY, null, defaultValue);
}

export function getConsoleExcludeText(defaultValue = DEFAULT_CONSOLE_EXCLUDE_TEXT): string {
  return readStoredText(CONSOLE_EXCLUDE_TEXT_KEY, null, defaultValue);
}

export function saveConsoleIncludeText(value: string): void {
  saveStoredText(CONSOLE_INCLUDE_TEXT_KEY, value);
}

export function saveConsoleExcludeText(value: string): void {
  saveStoredText(CONSOLE_EXCLUDE_TEXT_KEY, value);
}
