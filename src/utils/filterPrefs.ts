const INCLUDE_TEXT_KEY = 'api-flow-filter-include';
const EXCLUDE_TEXT_KEY = 'api-flow-filter-exclude';

export const DEFAULT_INCLUDE_TEXT = 'api';
export const DEFAULT_EXCLUDE_TEXT =
  'google-analytics,sentry,datadog,amplitude,hotjar,segment';

export function getIncludeText(defaultValue = DEFAULT_INCLUDE_TEXT): string {
  try {
    const stored = localStorage.getItem(INCLUDE_TEXT_KEY);
    if (stored !== null) return stored;
  } catch {
    // Ignore storage errors.
  }

  return defaultValue;
}

export function getExcludeText(defaultValue = DEFAULT_EXCLUDE_TEXT): string {
  try {
    const stored = localStorage.getItem(EXCLUDE_TEXT_KEY);
    if (stored !== null) return stored;
  } catch {
    // Ignore storage errors.
  }

  return defaultValue;
}

export function saveIncludeText(value: string): void {
  try {
    localStorage.setItem(INCLUDE_TEXT_KEY, value);
  } catch {
    // Ignore storage errors.
  }
}

export function saveExcludeText(value: string): void {
  try {
    localStorage.setItem(EXCLUDE_TEXT_KEY, value);
  } catch {
    // Ignore storage errors.
  }
}
