import { useTheme } from '../../hooks/useTheme';
import { IconButton } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';

export type WorkspaceMode = 'network' | 'storage' | 'console';
export type NetworkViewMode = 'flow' | 'timeline';

const WORKSPACE_PANEL_BUTTONS: { mode: WorkspaceMode; label: string }[] = [
  { mode: 'network', label: 'Network' },
  { mode: 'storage', label: 'Storage' },
  { mode: 'console', label: 'Console' },
];

type ToolbarProps = {
  requestCount: number;
  totalRequestCount: number;
  workspaceMode: WorkspaceMode;
  openPanels: WorkspaceMode[];
  onWorkspaceModeChange: (workspaceMode: WorkspaceMode) => void;
  onResetLayout: () => void;
};

export function Toolbar({
  requestCount,
  totalRequestCount,
  workspaceMode,
  openPanels,
  onWorkspaceModeChange,
  onResetLayout,
}: ToolbarProps) {
  const isNetworkMode = workspaceMode === 'network';
  const isStorageMode = workspaceMode === 'storage';

  return (
    <header className="toolbar">
      <div className="toolbar-row toolbar-row-primary">
        <div className="toolbar-brand">
          <h1>API Flow</h1>
          <div className="toolbar-stats" aria-label="Capture summary">
            {isNetworkMode ? (
              <>
                <span className="toolbar-chip">{requestCount} shown</span>
                {totalRequestCount !== requestCount ? (
                  <span className="toolbar-chip">{totalRequestCount} captured</span>
                ) : null}
              </>
            ) : isStorageMode ? (
              <span className="toolbar-chip">Storage viewer</span>
            ) : (
              <span className="toolbar-chip">{requestCount} logs</span>
            )}
          </div>
        </div>

        <div className="toolbar-spacer" />

        <div className="toolbar-cluster">
          <SegmentedControl
            size="sm"
            ariaLabel="Workspace panels"
            value={workspaceMode}
            onChange={onWorkspaceModeChange}
            options={WORKSPACE_PANEL_BUTTONS.map(({ mode, label }) => {
              const isActive = workspaceMode === mode;
              const isOpen = openPanels.includes(mode);
              return {
                value: mode,
                label,
                title: isOpen ? `${label} 패널로 이동` : `${label} 패널 열기`,
                // 열려 있지만 포커스되지 않은 패널은 하단에 작은 점으로 표시.
                className:
                  isOpen && !isActive
                    ? "relative after:absolute after:bottom-[3px] after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-accent after:content-['']"
                    : undefined,
              };
            })}
          />
          <IconButton
            size="md"
            aria-label="레이아웃 초기화"
            title="레이아웃 초기화 (기본 배치로)"
            onClick={onResetLayout}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M14 3v18M14 12h7" />
            </svg>
          </IconButton>
          <ThemeToggleButton />
        </div>
      </div>
    </header>
  );
}

function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <IconButton
      size="md"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggleTheme}
    >
      {isDark ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </IconButton>
  );
}
