/**
 * 패널 레이아웃 설정: 상세 패널 너비, 스택 레이아웃의 상단 영역 높이,
 * 수동 가로/세로 분할 방향 고정(null = 자동).
 */
import { readNumber, readString, removeKey, writeNumber, writeString } from './localStoragePrefs';

const DETAIL_PANEL_WIDTH_KEY = 'api-flow-detail-panel-width';
const STACKED_PRIMARY_HEIGHT_KEY = 'api-flow-stacked-primary-height';
const SPLIT_LAYOUT_OVERRIDE_KEY = 'api-flow-split-layout-override';

export type SplitLayoutOverride = 'horizontal' | 'vertical' | null;

export const DEFAULT_DETAIL_PANEL_WIDTH = 460;

/** 스택 레이아웃 기본 높이: 뷰포트의 42%. */
export function getDefaultStackedPrimaryHeight(): number {
  return Math.round(window.innerHeight * 0.42);
}

export function getDetailPanelWidth(defaultValue = DEFAULT_DETAIL_PANEL_WIDTH): number {
  return readNumber(DETAIL_PANEL_WIDTH_KEY, defaultValue);
}

export function saveDetailPanelWidth(value: number): void {
  writeNumber(DETAIL_PANEL_WIDTH_KEY, value);
}

export function getStackedPrimaryHeight(defaultValue?: number): number {
  const fallback = defaultValue ?? getDefaultStackedPrimaryHeight();
  return readNumber(STACKED_PRIMARY_HEIGHT_KEY, fallback);
}

export function saveStackedPrimaryHeight(value: number): void {
  writeNumber(STACKED_PRIMARY_HEIGHT_KEY, value);
}

export function getSplitLayoutOverride(): SplitLayoutOverride {
  const stored = readString(SPLIT_LAYOUT_OVERRIDE_KEY);
  if (stored === 'horizontal' || stored === 'vertical') return stored;
  return null;
}

export function saveSplitLayoutOverride(value: SplitLayoutOverride): void {
  if (value === null) {
    removeKey(SPLIT_LAYOUT_OVERRIDE_KEY);
  } else {
    writeString(SPLIT_LAYOUT_OVERRIDE_KEY, value);
  }
}
