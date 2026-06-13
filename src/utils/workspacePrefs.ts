/** 활성 워크스페이스 탭(network / storage / console)을 저장합니다. */
import type { WorkspaceMode } from '../components/Toolbar';
import { readEnum, writeString } from './localStoragePrefs';

const WORKSPACE_MODE_KEY = 'api-flow-workspace-mode';

const WORKSPACE_MODES: WorkspaceMode[] = ['network', 'storage', 'console'];

export function getWorkspaceMode(): WorkspaceMode {
  return readEnum(WORKSPACE_MODE_KEY, WORKSPACE_MODES, 'network');
}

export function saveWorkspaceMode(mode: WorkspaceMode): void {
  writeString(WORKSPACE_MODE_KEY, mode);
}
