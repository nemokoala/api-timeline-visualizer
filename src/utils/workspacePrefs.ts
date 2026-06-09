import type { WorkspaceMode } from '../components/Toolbar';

const WORKSPACE_MODE_KEY = 'api-flow-workspace-mode';

function isWorkspaceMode(value: string): value is WorkspaceMode {
  return value === 'network' || value === 'storage' || value === 'console';
}

export function getWorkspaceMode(): WorkspaceMode {
  try {
    const stored = localStorage.getItem(WORKSPACE_MODE_KEY);
    if (stored && isWorkspaceMode(stored)) return stored;
  } catch {
    // Ignore storage errors.
  }

  return 'network';
}

export function saveWorkspaceMode(mode: WorkspaceMode): void {
  try {
    localStorage.setItem(WORKSPACE_MODE_KEY, mode);
  } catch {
    // Ignore storage errors.
  }
}
