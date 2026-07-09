import { useEffect, useRef } from 'react';
import {
  DockviewReact,
  themeDark,
  themeLight,
  type DockviewApi,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
  type IWatermarkPanelProps,
} from 'dockview-react';
import type { WorkspaceMode } from './Toolbar';
import { useTheme } from '../../hooks/useTheme';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { getDockLayout, saveDockLayout } from '../../utils/dockLayoutPrefs';
import { ConsolePanel } from '../panels/ConsolePanel';
import { NetworkPanel } from '../panels/NetworkPanel';
import { StoragePanel } from '../panels/StoragePanel';
import { JsonViewer } from '../shared/JsonViewer';

/** Pop out으로 연 JSON 전용 동적 패널의 id 접두사. */
const JSON_PANEL_ID_PREFIX = 'json:';

/** 도킹 패널 메타. id는 WorkspaceMode와 1:1로 매칭된다. */
export const WORKSPACE_PANEL_ORDER: WorkspaceMode[] = ['network', 'storage', 'console'];

const WORKSPACE_PANEL_TITLES: Record<WorkspaceMode, string> = {
  network: 'Network',
  storage: 'Storage',
  console: 'Console',
};

function isWorkspaceMode(value: string): value is WorkspaceMode {
  return (WORKSPACE_PANEL_ORDER as string[]).includes(value);
}

// dockview는 컴포넌트에 IDockviewPanelProps를 넘기지만, 각 패널은 컨텍스트에서
// 상태를 읽으므로 props를 사용하지 않는다.
/** Pop out으로 연 JSON을 표시하는 동적 패널. 값은 컨텍스트에서 패널 id로 조회한다. */
function JsonDockPanel({ params }: IDockviewPanelProps) {
  const { getJsonPanelData } = useWorkspace();
  const dataId = typeof params?.dataId === 'string' ? params.dataId : '';
  const data = getJsonPanelData(dataId);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto p-2">
      {data ? (
        <JsonViewer value={data.value} />
      ) : (
        <DockWatermark message="JSON 데이터가 없습니다." hint="패널을 닫고 다시 Pop out 해 주세요." />
      )}
    </div>
  );
}

const components: Record<string, React.FunctionComponent<IDockviewPanelProps>> = {
  network: () => <NetworkPanel />,
  storage: () => <StoragePanel />,
  console: () => <ConsolePanel />,
  json: (props) => <JsonDockPanel {...props} />,
};

function DockviewWatermark(_props: IWatermarkPanelProps) {
  return <DockWatermark />;
}

function DockWatermark({
  message = '표시할 패널이 없습니다.',
  hint = '상단에서 Network · Storage · Console을 선택해 다시 여세요.',
}: {
  message?: string;
  hint?: string;
}) {
  return (
    <div className="grid h-full place-content-center gap-1.5 p-6 text-center text-ink-sub">
      <p>{message}</p>
      <p className="text-[12px] text-ink-weak">{hint}</p>
    </div>
  );
}

/**
 * 저장된 레이아웃이 없을 때의 기본 배치: Network(위) · Console(아래) 상하 분리.
 * Storage는 필요할 때 상단 버튼으로 연다.
 */
export function buildDefaultWorkspaceLayout(api: DockviewApi): void {
  api.clear();
  api.addPanel({ id: 'network', component: 'network', title: WORKSPACE_PANEL_TITLES.network });
  api.addPanel({
    id: 'console',
    component: 'console',
    title: WORKSPACE_PANEL_TITLES.console,
    position: { referencePanel: 'network', direction: 'below' },
  });
  api.getPanel('network')?.api.setActive();
}

/** 해당 뷰 패널을 열거나(닫혀 있으면 새로 추가) 포커스한다. */
export function focusOrOpenWorkspacePanel(api: DockviewApi, mode: WorkspaceMode): void {
  const existing = api.getPanel(mode);
  if (existing) {
    existing.api.setActive();
    return;
  }
  api.addPanel({ id: mode, component: mode, title: WORKSPACE_PANEL_TITLES[mode] });
}

function readOpenPanels(api: DockviewApi): WorkspaceMode[] {
  return api.panels.map((panel) => panel.id).filter(isWorkspaceMode);
}

type WorkspaceDockProps = {
  onApiReady: (api: DockviewApi) => void;
  onActivePanelChange: (mode: WorkspaceMode) => void;
  onOpenPanelsChange: (modes: WorkspaceMode[]) => void;
};

export function WorkspaceDock({ onApiReady, onActivePanelChange, onOpenPanelsChange }: WorkspaceDockProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const apiRef = useRef<DockviewApi | null>(null);

  const onReady = (event: DockviewReadyEvent) => {
    const api = event.api;
    apiRef.current = api;

    const saved = getDockLayout();
    let restored = false;
    if (saved) {
      try {
        api.fromJSON(saved);
        // Pop out JSON 패널은 값이 세션 메모리에만 있으므로 복원하지 않고 제거한다.
        for (const panel of [...api.panels]) {
          if (panel.id.startsWith(JSON_PANEL_ID_PREFIX)) api.removePanel(panel);
        }
        restored = api.panels.length > 0;
      } catch {
        restored = false;
      }
    }
    if (!restored) {
      buildDefaultWorkspaceLayout(api);
    }

    onApiReady(api);
    onOpenPanelsChange(readOpenPanels(api));
    const activeId = api.activePanel?.id;
    if (activeId && isWorkspaceMode(activeId)) onActivePanelChange(activeId);

    api.onDidLayoutChange(() => {
      saveDockLayout(api.toJSON());
      onOpenPanelsChange(readOpenPanels(api));
    });
    api.onDidActivePanelChange((event) => {
      const id = event.panel?.id;
      if (id && isWorkspaceMode(id)) onActivePanelChange(id);
    });
  };

  // 테마 토글 시 dockview 테마도 즉시 반영.
  useEffect(() => {
    apiRef.current?.updateOptions({ theme: isDark ? themeDark : themeLight });
  }, [isDark]);

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden">
      <DockviewReact
        components={components}
        watermarkComponent={DockviewWatermark}
        onReady={onReady}
        theme={isDark ? themeDark : themeLight}
      />
    </div>
  );
}
