/** 각 패널 헤더의 Include/Exclude 필터 행 펼침 상태를 뷰별로 저장합니다. */
import type { WorkspaceMode } from '../components/Toolbar';
import { readFlag, writeFlag } from './localStoragePrefs';

const key = (scope: WorkspaceMode) => `api-flow-panel-filters-open-${scope}`;

export function getPanelFiltersOpen(scope: WorkspaceMode, defaultOpen: boolean): boolean {
  return readFlag(key(scope), defaultOpen);
}

export function savePanelFiltersOpen(scope: WorkspaceMode, open: boolean): void {
  writeFlag(key(scope), open);
}
