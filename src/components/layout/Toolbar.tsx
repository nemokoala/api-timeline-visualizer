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
    <header className="flex flex-col gap-2 border-b border-line-weak bg-surface px-3.5 pt-2.5 pb-3">
      <div className="flex min-w-0 items-center gap-3 max-[980px]:flex-wrap">
        <div className="flex flex-none items-center gap-2.5 max-[980px]:flex-auto">
          <h1 className="m-0 whitespace-nowrap text-[15px] font-bold tracking-[-0.01em] text-ink-strong">
            API Flow
          </h1>
          <div
            className="flex flex-wrap items-center gap-1.5 max-[720px]:hidden"
            aria-label="Capture summary"
          >
            {isNetworkMode ? (
              <>
                <ToolbarChip>{requestCount} shown</ToolbarChip>
                {totalRequestCount !== requestCount ? (
                  <ToolbarChip>{totalRequestCount} captured</ToolbarChip>
                ) : null}
              </>
            ) : isStorageMode ? (
              <ToolbarChip>Storage viewer</ToolbarChip>
            ) : (
              <ToolbarChip>{requestCount} logs</ToolbarChip>
            )}
          </div>
        </div>

        <div className="min-w-2 flex-auto" />

        <div className="flex flex-none items-center gap-2 max-[980px]:ml-auto">
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

function ToolbarChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="whitespace-nowrap rounded-full border-0 bg-fill px-2.5 py-[3px] text-[11px] font-medium leading-[1.35] text-ink-weak">
      {children}
    </span>
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
