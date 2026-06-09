const GROUP_FLOW_BY_TIME_KEY = 'api-flow-group-flow-by-time';

export function getGroupFlowByTime(defaultValue = true): boolean {
  try {
    const stored = localStorage.getItem(GROUP_FLOW_BY_TIME_KEY);
    if (stored === 'false') return false;
    if (stored === 'true') return true;
  } catch {
    // Ignore storage errors.
  }

  return defaultValue;
}

export function saveGroupFlowByTime(value: boolean): void {
  try {
    localStorage.setItem(GROUP_FLOW_BY_TIME_KEY, String(value));
  } catch {
    // Ignore storage errors.
  }
}
