import { createContext, useContext, type Dispatch, type SetStateAction } from 'react';
import type { NetworkViewMode, WorkspaceMode } from '../components/layout/Toolbar';
import type { ConsoleEntry } from '../types/console';
import type { ApiRequest, TimelineItem } from '../types/network';
import type { ConsoleSearchOccurrence } from '../utils/consoleSearch';
import type { FilterableConsoleLevel } from '../utils/consoleLevelPrefs';
import type { FlowLayout } from '../utils/flowLayoutPrefs';
import type { RequestSearchSummary, SearchOccurrence } from '../utils/requestSearch';
import type { FilterableMethod, StatusGroup } from '../utils/requestFilterPrefs';
import type { ToggleableResourceKind } from '../utils/resourceTypePrefs';
import type { StorageSearchOccurrence } from '../utils/storageSearch';

/**
 * 도킹 패널(Network/Storage/Console)에 App의 상태를 주입하기 위한 컨텍스트.
 *
 * dockview는 패널을 React 포털로 같은 렌더 트리 안에 그리므로, 이 Provider 하위라면
 * 각 패널 컴포넌트에서 컨텍스트를 그대로 읽을 수 있다. 상태가 매우 자주 바뀌기 때문에
 * dockview params 대신 컨텍스트로 전달한다.
 */
/** 패널 헤더의 검색바가 사용하는, 스코프(뷰)별 검색 상태와 동작. */
export type PanelSearchModel = {
  searchText: string;
  onSearchTextChange: (value: string) => void;
  occurrenceCount: number;
  matchIndex: number;
  scopeJumpCount: number;
  activeScopeOrder: number;
  scopeLabel: string;
  placeholder: string;
  onNext: () => void;
  onPrevious: () => void;
  onNextScope: () => void;
  onPreviousScope: () => void;
};

/** 검색 옵션(대소문자/전체 단어)은 모든 뷰에 공통 적용된다. */
export type SearchOptionsModel = {
  matchCase: boolean;
  wholeWord: boolean;
  onMatchCaseChange: (value: boolean) => void;
  onWholeWordChange: (value: boolean) => void;
};

/** 패널 헤더의 Include/Exclude 필터 상태와 동작. */
export type PanelFilterModel = {
  includeText: string;
  excludeText: string;
  onIncludeTextChange: (value: string) => void;
  onExcludeTextChange: (value: string) => void;
  includePlaceholder: string;
  excludePlaceholder: string;
};

export type JsonPanelData = { title: string; value: unknown };

export type WorkspaceContextValue = {
  // 검색·필터(패널별)
  searchModels: Record<WorkspaceMode, PanelSearchModel>;
  filterModels: Record<WorkspaceMode, PanelFilterModel>;
  searchOptions: SearchOptionsModel;
  activeMode: WorkspaceMode;
  // Network
  networkViewMode: NetworkViewMode;
  timelineItems: TimelineItem[];
  displayedRequests: ApiRequest[];
  selectedRequestId: string | null;
  groupFlowByTime: boolean;
  enabledResourceKinds: ToggleableResourceKind[];
  onToggleResourceKind: (kind: ToggleableResourceKind, enabled: boolean) => void;
  onSetAllResourceKinds: (enabled: boolean) => void;
  enabledStatusGroups: StatusGroup[];
  onToggleStatusGroup: (group: StatusGroup, enabled: boolean) => void;
  onSetAllStatusGroups: (enabled: boolean) => void;
  enabledMethods: FilterableMethod[];
  onToggleMethod: (method: FilterableMethod, enabled: boolean) => void;
  onSetAllMethods: (enabled: boolean) => void;
  networkSearchText: string;
  searchOccurrenceByRequest: Map<string, RequestSearchSummary>;
  activeGlobalSearchIndex: number | null;
  flowLayoutRevision: number;
  flowLayoutSnapshot: FlowLayout;
  onSelectRequest: (requestId: string) => void;
  /** 행 컨텍스트 메뉴의 즉시 재전송. 편집이 필요하면 상세 패널의 Edit를 쓴다. */
  onResendRequest: (requestId: string) => void;
  onFlowLayoutChange: (layout: FlowLayout) => void;
  // Network 세션 액션(Flow·Timeline / Group time / Export / Import / Clear)
  onNetworkViewModeChange: (networkViewMode: NetworkViewMode) => void;
  onGroupFlowByTimeChange: (groupFlowByTime: boolean) => void;
  onExportSession: () => void;
  onImportSession: () => void;
  onClear: () => void;
  canExport: boolean;
  canClear: boolean;
  sessionNotice: string | null;
  // Network 상세 패널
  selectedRequest: ApiRequest | null;
  bodyLoadingId: string | null;
  networkSearchMatchIndex: number;
  activeSearchOccurrence: SearchOccurrence | null;
  onLoadResponseBody: (requestId: string) => void;
  /** 이미지 썸네일용 응답 본문 지연 로드(상세 스피너 미표시). */
  onEnsureThumbnailBody: (requestId: string) => void;
  onCloseDetail: () => void;
  /**
   * JSON 값을 이동·크기조절 가능한 dockview 플로팅 패널로 연다.
   * fullscreen이면 마진만 남기고 화면을 가득 채우는 크기로 연다(전체화면 대체).
   */
  openJsonPanel: (value: unknown, options?: { fullscreen?: boolean }) => void;
  /** dockview JSON 패널이 자신의 데이터를 조회한다(패널 id로). */
  getJsonPanelData: (dataId: string) => JsonPanelData | undefined;
  /** 도킹된(탭) 패널을 이동·크기조절 가능한 플로팅 창으로 분리한다. */
  floatPanel: (mode: WorkspaceMode) => void;
  // Storage
  storageSearchText: string;
  storageSearchMatchIndex: number;
  storageIncludeText: string;
  storageExcludeText: string;
  onStorageSearchOccurrencesChange: (occurrences: StorageSearchOccurrence[]) => void;
  onStorageSearchMatchIndexChange: (index: number) => void;
  // Console
  consoleEntries: ConsoleEntry[];
  selectedConsoleEntryId: string | null;
  consoleSearchText: string;
  consoleIncludeText: string;
  consoleExcludeText: string;
  consoleSearchMatchIndex: number;
  enabledConsoleLevels: FilterableConsoleLevel[];
  onToggleConsoleLevel: (level: FilterableConsoleLevel, enabled: boolean) => void;
  onSetAllConsoleLevels: (enabled: boolean) => void;
  // REPL 입력이 폴링 캡처와 경합하지 않도록 함수형 갱신을 받는다.
  onConsoleEntriesChange: Dispatch<SetStateAction<ConsoleEntry[]>>;
  onConsoleSelectedEntryIdChange: (entryId: string | null) => void;
  onConsoleSearchOccurrencesChange: (occurrences: ConsoleSearchOccurrence[]) => void;
  onConsoleSearchMatchIndexChange: (index: number) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export const WorkspaceProvider = WorkspaceContext.Provider;

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return value;
}

/** Provider 밖에서도 안전하게 쓰기 위한 선택적 접근(없으면 null). */
export function useWorkspaceOptional(): WorkspaceContextValue | null {
  return useContext(WorkspaceContext);
}
