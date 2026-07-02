/** dockview 도킹 레이아웃(패널 배치/크기)을 localStorage에 저장/복원합니다. */
import type { SerializedDockview } from 'dockview-react';
import { readJson, removeKey, writeJson } from './localStoragePrefs';

const DOCK_LAYOUT_KEY = 'api-flow-dock-layout';

export function getDockLayout(): SerializedDockview | null {
  return readJson<SerializedDockview>(DOCK_LAYOUT_KEY);
}

export function saveDockLayout(layout: SerializedDockview): void {
  writeJson(DOCK_LAYOUT_KEY, layout);
}

export function clearDockLayout(): void {
  removeKey(DOCK_LAYOUT_KEY);
}
