/** 메인 툴바의 펼침/접힘 상태를 저장합니다. */
import { readFlag, writeFlag } from './localStoragePrefs';

const TOOLBAR_EXPANDED_KEY = 'api-flow-toolbar-expanded';

export function getToolbarExpanded(defaultValue = true): boolean {
  return readFlag(TOOLBAR_EXPANDED_KEY, defaultValue);
}

export function setToolbarExpanded(expanded: boolean): void {
  writeFlag(TOOLBAR_EXPANDED_KEY, expanded);
}
