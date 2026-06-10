const DETAIL_PANEL_WIDTH_KEY = 'api-flow-detail-panel-width';
const STACKED_PRIMARY_HEIGHT_KEY = 'api-flow-stacked-primary-height';
const SPLIT_LAYOUT_OVERRIDE_KEY = 'api-flow-split-layout-override';

export type SplitLayoutOverride = 'horizontal' | 'vertical' | null;

export const DEFAULT_DETAIL_PANEL_WIDTH = 460;

export function getDefaultStackedPrimaryHeight(): number {
  return Math.round(window.innerHeight * 0.42);
}

export function getDetailPanelWidth(defaultValue = DEFAULT_DETAIL_PANEL_WIDTH): number {
  try {
    const stored = localStorage.getItem(DETAIL_PANEL_WIDTH_KEY);
    if (!stored) return defaultValue;
    const parsed = Number(stored);
    if (!Number.isFinite(parsed)) return defaultValue;
    return parsed;
  } catch {
    return defaultValue;
  }
}

export function saveDetailPanelWidth(value: number): void {
  try {
    localStorage.setItem(DETAIL_PANEL_WIDTH_KEY, String(value));
  } catch {
    // Ignore storage errors.
  }
}

export function getStackedPrimaryHeight(defaultValue?: number): number {
  const fallback = defaultValue ?? getDefaultStackedPrimaryHeight();

  try {
    const stored = localStorage.getItem(STACKED_PRIMARY_HEIGHT_KEY);
    if (!stored) return fallback;
    const parsed = Number(stored);
    if (!Number.isFinite(parsed)) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

export function saveStackedPrimaryHeight(value: number): void {
  try {
    localStorage.setItem(STACKED_PRIMARY_HEIGHT_KEY, String(value));
  } catch {
    // Ignore storage errors.
  }
}

export function getSplitLayoutOverride(): SplitLayoutOverride {
  try {
    const stored = localStorage.getItem(SPLIT_LAYOUT_OVERRIDE_KEY);
    if (stored === 'horizontal' || stored === 'vertical') return stored;
    return null;
  } catch {
    return null;
  }
}

export function saveSplitLayoutOverride(value: SplitLayoutOverride): void {
  try {
    if (value === null) {
      localStorage.removeItem(SPLIT_LAYOUT_OVERRIDE_KEY);
    } else {
      localStorage.setItem(SPLIT_LAYOUT_OVERRIDE_KEY, value);
    }
  } catch {
    // Ignore storage errors.
  }
}
