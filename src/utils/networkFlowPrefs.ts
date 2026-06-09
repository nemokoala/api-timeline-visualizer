const GROUP_FLOW_BY_TIME_KEY = 'api-flow-group-flow-by-time';
const NETWORK_VIEW_MODE_KEY = 'api-flow-network-view-mode';

export type NetworkViewMode = 'flow' | 'timeline';

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

export function getNetworkViewMode(defaultValue: NetworkViewMode = 'timeline'): NetworkViewMode {
  try {
    const stored = localStorage.getItem(NETWORK_VIEW_MODE_KEY);
    if (stored === 'flow' || stored === 'timeline') return stored;
  } catch {
    // Ignore storage errors.
  }

  return defaultValue;
}

export function saveNetworkViewMode(value: NetworkViewMode): void {
  try {
    localStorage.setItem(NETWORK_VIEW_MODE_KEY, value);
  } catch {
    // Ignore storage errors.
  }
}
