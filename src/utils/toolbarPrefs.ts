const TOOLBAR_EXPANDED_KEY = 'api-flow-toolbar-expanded';

export function getToolbarExpanded(defaultValue = true): boolean {
  try {
    const stored = localStorage.getItem(TOOLBAR_EXPANDED_KEY);
    if (stored === 'false') return false;
    if (stored === 'true') return true;
  } catch {
    // Ignore storage errors.
  }

  return defaultValue;
}

export function setToolbarExpanded(expanded: boolean): void {
  try {
    localStorage.setItem(TOOLBAR_EXPANDED_KEY, String(expanded));
  } catch {
    // Ignore storage errors.
  }
}
