import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DockviewApi } from 'dockview-react';
import {
  buildDefaultWorkspaceLayout,
  focusOrOpenWorkspacePanel,
  WorkspaceDock,
} from './components/layout/WorkspaceDock';
import { WorkspaceProvider, type WorkspaceContextValue } from './contexts/WorkspaceContext';
import { SearchOptionsProvider } from './contexts/SearchOptionsContext';
import { Toolbar, type NetworkViewMode, type WorkspaceMode } from './components/layout/Toolbar';
import type { ApiRequest } from './types/network';
import {
  buildConsoleOccurrenceSummaryByEntry,
  getNextConsoleEntryJumpIndex,
  type ConsoleSearchOccurrence,
} from './utils/consoleSearch';
import { exportSession, parseSession, pickSessionFile } from './utils/sessionIO';
import {
  EMPTY_FLOW_LAYOUT,
  type FlowLayout,
} from './utils/flowLayoutPrefs';
import { matchesTextFilters, parseResponseContent } from './utils/requestParser';
import { buildReplayDraft } from './utils/requestCodeSnippets';
import { canResendRequest, resendRequest } from './utils/requestResend';
import { useT } from './i18n';
import {
  buildSearchOccurrenceSummaryByRequest,
  buildSearchOccurrences,
  getNextRequestJumpIndex,
  getSearchMatchIndexForRequest,
} from './utils/requestSearch';
import {
  getConsoleExcludeText,
  getConsoleIncludeText,
  getNetworkExcludeText,
  getNetworkIncludeText,
  getStorageExcludeText,
  getStorageIncludeText,
  saveConsoleExcludeText,
  saveConsoleIncludeText,
  saveNetworkExcludeText,
  saveNetworkIncludeText,
  saveStorageExcludeText,
  saveStorageIncludeText,
} from './utils/filterPrefs';
import {
  getConsoleSearchText,
  getNetworkSearchText,
  getSearchMatchCase,
  getSearchWholeWord,
  getStorageSearchText,
  saveConsoleSearchText,
  saveNetworkSearchText,
  saveSearchMatchCase,
  saveSearchWholeWord,
  saveStorageSearchText,
} from './utils/searchPrefs';
import type { StorageSearchOccurrence } from './utils/storageSearch';
import {
  buildStorageOccurrenceSummaryByItem,
  getNextStorageItemJumpIndex,
  storageTargetKey,
} from './utils/storageSearch';
import { clearDockLayout } from './utils/dockLayoutPrefs';
import { toTimelineItems } from './utils/timeline';
import {
  getClearNetworkOnReload,
  getCollapsePathIds,
  getGroupFlowByTime,
  getNetworkViewMode,
  saveClearNetworkOnReload,
  saveCollapsePathIds,
  saveGroupFlowByTime,
  saveNetworkViewMode,
} from './utils/networkFlowPrefs';
import { getWorkspaceMode, saveWorkspaceMode } from './utils/workspacePrefs';
import {
  getEnabledResourceKinds,
  isToggleableResourceKind,
  TOGGLEABLE_RESOURCE_KINDS,
  saveEnabledResourceKinds,
  type ToggleableResourceKind,
} from './utils/resourceTypePrefs';
import {
  FILTERABLE_METHODS,
  STATUS_GROUPS,
  getEnabledMethods,
  getEnabledStatusGroups,
  matchesMethodFilter,
  matchesStatusFilter,
  saveEnabledMethods,
  saveEnabledStatusGroups,
} from './utils/requestFilterPrefs';
import {
  FILTERABLE_CONSOLE_LEVELS,
  getEnabledConsoleLevels,
  matchesConsoleLevelFilter,
  saveEnabledConsoleLevels,
} from './utils/consoleLevelPrefs';
import { countGroupedConsoleRows } from './utils/consoleGrouping';
import { matchesIncludeExcludeFilters } from './utils/textFilters';
import { useConsoleCapture } from './hooks/useConsoleCapture';
import { useNetworkCapture } from './hooks/useNetworkCapture';
import { useOnPageNavigated } from './hooks/useOnPageNavigated';
import { usePersistedState } from './hooks/usePersistedState';
import { useSearchScope } from './hooks/useSearchScope';
import { useToggleableSet } from './hooks/useToggleableSet';

const PRELOAD_CONCURRENCY = 4;
const PRELOAD_MAX = 100;

export default function App() {
  const t = useT();

  // 캡처 소스. 네트워크(HTTP + WebSocket)와 콘솔은 각자 폴링/리스너를 품고 있다.
  const { requests, setRequests, networkRequestById } = useNetworkCapture();
  const [consoleEntries, setConsoleEntries] = useConsoleCapture();

  // 세션 import 후 FlowChartView가 저장된 레이아웃을 다시 읽도록 알리는 신호값.
  const [flowLayoutRevision, setFlowLayoutRevision] = useState(0);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [bodyLoadingId, setBodyLoadingId] = useState<string | null>(null);
  const [workspaceMode, setWorkspaceMode] = usePersistedState<WorkspaceMode>(getWorkspaceMode, saveWorkspaceMode);
  const [networkViewMode, setNetworkViewMode] = usePersistedState<NetworkViewMode>(getNetworkViewMode, saveNetworkViewMode);
  const [groupFlowByTime, setGroupFlowByTime] = usePersistedState(getGroupFlowByTime, saveGroupFlowByTime);
  const [clearNetworkOnReload, setClearNetworkOnReload] = usePersistedState(
    getClearNetworkOnReload,
    saveClearNetworkOnReload,
  );
  const [collapsePathIds, setCollapsePathIds] = usePersistedState(getCollapsePathIds, saveCollapsePathIds);

  // 구조화 필터. 넷 다 "표준 순서 중 켜진 것만 저장"이라 같은 훅을 쓴다.
  const resourceKinds = useToggleableSet(
    TOGGLEABLE_RESOURCE_KINDS,
    getEnabledResourceKinds,
    saveEnabledResourceKinds,
  );
  const statusGroups = useToggleableSet(STATUS_GROUPS, getEnabledStatusGroups, saveEnabledStatusGroups);
  const methods = useToggleableSet(FILTERABLE_METHODS, getEnabledMethods, saveEnabledMethods);
  const consoleLevels = useToggleableSet(
    FILTERABLE_CONSOLE_LEVELS,
    getEnabledConsoleLevels,
    saveEnabledConsoleLevels,
  );

  const [networkIncludeText, setNetworkIncludeText] = usePersistedState(getNetworkIncludeText, saveNetworkIncludeText);
  const [networkExcludeText, setNetworkExcludeText] = usePersistedState(getNetworkExcludeText, saveNetworkExcludeText);
  const [storageIncludeText, setStorageIncludeText] = usePersistedState(getStorageIncludeText, saveStorageIncludeText);
  const [storageExcludeText, setStorageExcludeText] = usePersistedState(getStorageExcludeText, saveStorageExcludeText);
  const [consoleIncludeText, setConsoleIncludeText] = usePersistedState(getConsoleIncludeText, saveConsoleIncludeText);
  const [consoleExcludeText, setConsoleExcludeText] = usePersistedState(getConsoleExcludeText, saveConsoleExcludeText);
  const [networkSearchText, setNetworkSearchText] = usePersistedState(getNetworkSearchText, saveNetworkSearchText);
  const [storageSearchText, setStorageSearchText] = usePersistedState(getStorageSearchText, saveStorageSearchText);
  const [consoleSearchText, setConsoleSearchText] = usePersistedState(getConsoleSearchText, saveConsoleSearchText);
  const [searchMatchCase, setSearchMatchCase] = usePersistedState(getSearchMatchCase, saveSearchMatchCase);
  const [searchWholeWord, setSearchWholeWord] = usePersistedState(getSearchWholeWord, saveSearchWholeWord);

  const [selectedConsoleEntryId, setSelectedConsoleEntryId] = useState<string | null>(null);
  // 스토리지·콘솔 히트는 각 뷰가 계산해 올려 준다(네트워크만 App이 직접 센다).
  const [storageOccurrences, setStorageOccurrences] = useState<StorageSearchOccurrence[]>([]);
  const [consoleOccurrences, setConsoleOccurrences] = useState<ConsoleSearchOccurrence[]>([]);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [openPanels, setOpenPanels] = useState<WorkspaceMode[]>([]);
  const dockApiRef = useRef<DockviewApi | null>(null);
  // 레이아웃은 세션 동안만 이 ref로 유지한다(뷰 전환 시 복원). DevTools를 다시 열면
  // requestId가 새로 찍혀 이전 좌표와 맞지 않으므로 localStorage 영속은 하지 않는다.
  // 진짜 영속이 필요하면 세션 export/import(JSON)를 쓴다.
  const flowLayoutRef = useRef<FlowLayout>(EMPTY_FLOW_LAYOUT);
  // Pop out으로 연 JSON 패널의 데이터(패널 id → 값). dockview 레이아웃에는 id만 저장하고
  // 실제 값은 여기(세션 메모리)에만 둔다. 새로고침 시엔 값이 없으므로 패널을 복원하지 않는다.
  const jsonPanelDataRef = useRef(new Map<string, { title: string; value: unknown }>());
  const jsonPanelSeqRef = useRef(0);
  const preloadQueueRef = useRef<string[]>([]);
  const preloadInFlightRef = useRef(new Set<string>());

  const searchOptions = useMemo(
    () => ({ matchCase: searchMatchCase, matchWholeWord: searchWholeWord }),
    [searchMatchCase, searchWholeWord],
  );

  const isConsoleMode = workspaceMode === 'console';

  const enabledResourceKindSet = useMemo(
    () => new Set<ToggleableResourceKind>(resourceKinds.enabled),
    [resourceKinds.enabled],
  );

  const filteredRequests = useMemo(
    () =>
      requests.filter(
        (request) =>
          // 토글 대상 종류는 켜졌을 때만 표시, 그 외('other' 등)는 항상 표시.
          (!isToggleableResourceKind(request.type) || enabledResourceKindSet.has(request.type)) &&
          matchesStatusFilter(request, statusGroups.enabled) &&
          matchesMethodFilter(request, methods.enabled) &&
          matchesTextFilters(request, networkIncludeText, networkExcludeText),
      ),
    [
      enabledResourceKindSet,
      methods.enabled,
      networkExcludeText,
      networkIncludeText,
      requests,
      statusGroups.enabled,
    ],
  );

  const networkOccurrences = useMemo(() => {
    if (!networkSearchText.trim()) return [];
    return buildSearchOccurrences(filteredRequests, networkSearchText, searchOptions);
  }, [filteredRequests, networkSearchText, searchOptions]);

  const networkSearch = useSearchScope({
    occurrences: networkOccurrences,
    searchText: networkSearchText,
    setSearchText: setNetworkSearchText,
    searchOptions,
    summarize: buildSearchOccurrenceSummaryByRequest,
    getScopeKey: (occurrence) => occurrence.requestId,
    getScopeOrder: (summary) => summary.requestOrder,
    getNextScopeJumpIndex: getNextRequestJumpIndex,
  });
  const storageSearch = useSearchScope({
    occurrences: storageOccurrences,
    searchText: storageSearchText,
    setSearchText: setStorageSearchText,
    searchOptions,
    summarize: buildStorageOccurrenceSummaryByItem,
    getScopeKey: (occurrence) => storageTargetKey(occurrence.target),
    getScopeOrder: (summary) => summary.itemOrder,
    getNextScopeJumpIndex: getNextStorageItemJumpIndex,
  });
  const consoleSearch = useSearchScope({
    occurrences: consoleOccurrences,
    searchText: consoleSearchText,
    setSearchText: setConsoleSearchText,
    searchOptions,
    summarize: buildConsoleOccurrenceSummaryByEntry,
    getScopeKey: (occurrence) => occurrence.entryId,
    getScopeOrder: (summary) => summary.entryOrder,
    getNextScopeJumpIndex: getNextConsoleEntryJumpIndex,
  });

  // 캡처 개수(= 툴바 "captured"). clear 표식만 제외한, 필터 이전의 전체 로그.
  const displayedConsoleEntries = useMemo(
    () => consoleEntries.filter((entry) => entry.level !== 'clear'),
    [consoleEntries],
  );
  // 표시 개수(= 툴바 "shown"). 레벨 필터 + Include/Exclude를 적용하고, 콘솔 뷰가 그리는
  // 실제 행 수(연속 중복을 접은 뒤)로 센다. ConsoleView.displayEntries와 같은 규칙이라야
  // 칩이 표를 정직하게 반영한다.
  const consoleShownCount = useMemo(() => {
    const hasIncludeExclude = Boolean(consoleIncludeText.trim() || consoleExcludeText.trim());
    const filtered = displayedConsoleEntries.filter((entry) => {
      if (!matchesConsoleLevelFilter(entry, consoleLevels.enabled)) return false;
      if (hasIncludeExclude) {
        const haystack = `${entry.text} ${entry.source ?? ''} ${entry.stack ?? ''}`;
        if (!matchesIncludeExcludeFilters(haystack, consoleIncludeText, consoleExcludeText)) return false;
      }
      return true;
    });
    return countGroupedConsoleRows(filtered);
  }, [consoleExcludeText, consoleIncludeText, consoleLevels.enabled, displayedConsoleEntries]);

  const displayedRequests = filteredRequests;
  const selectedRequest = displayedRequests.find((request) => request.id === selectedRequestId) ?? null;
  const timelineItems = useMemo(() => toTimelineItems(displayedRequests), [displayedRequests]);

  useEffect(() => {
    if (!selectedRequestId) return;
    if (displayedRequests.some((request) => request.id === selectedRequestId)) return;
    setSelectedRequestId(null);
  }, [displayedRequests, selectedRequestId]);

  useEffect(() => {
    if (!networkSearchText.trim() || !networkOccurrences.length) return;

    const clampedIndex = networkSearch.matchIndex % networkOccurrences.length;
    if (clampedIndex !== networkSearch.matchIndex) {
      networkSearch.setMatchIndex(clampedIndex);
      return;
    }

    const activeOccurrence = networkOccurrences[clampedIndex];
    if (activeOccurrence) setSelectedRequestId(activeOccurrence.requestId);
  }, [networkOccurrences, networkSearch.matchIndex, networkSearch.setMatchIndex, networkSearchText]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'f') return;
      event.preventDefault();
      // 검색바가 패널마다 있으므로 현재 활성 패널의 검색창에 포커스한다.
      const input = document.querySelector<HTMLInputElement>(`[data-panel-search="${workspaceMode}"] input`);
      input?.focus();
      input?.select();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [workspaceMode]);

  useEffect(() => {
    if (!sessionNotice) return;
    const timeoutId = window.setTimeout(() => setSessionNotice(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [sessionNotice]);

  const handleClear = useCallback(() => {
    networkRequestById.current.clear();
    setRequests([]);
    setSelectedRequestId(null);
    setNetworkSearchText('');
    networkSearch.setMatchIndex(0);
    flowLayoutRef.current = EMPTY_FLOW_LAYOUT;
    setFlowLayoutRevision((revision) => revision + 1);
  }, [networkRequestById, networkSearch.setMatchIndex, setNetworkSearchText, setRequests]);

  // 검사 중인 페이지가 새로고침·이동되면 옵션이 켜진 경우 기록을 지운다.
  useOnPageNavigated(() => {
    if (clearNetworkOnReload) handleClear();
  });

  const handleFlowLayoutChange = useCallback((layout: FlowLayout) => {
    flowLayoutRef.current = layout;
  }, []);

  const handleDockApiReady = useCallback((api: DockviewApi) => {
    dockApiRef.current = api;
  }, []);

  const openJsonPanel = useCallback((value: unknown, options?: { fullscreen?: boolean }) => {
    const api = dockApiRef.current;
    if (!api) return;

    const seq = (jsonPanelSeqRef.current += 1);
    const id = `json:${seq}`;
    const title = `JSON ${seq}`;
    jsonPanelDataRef.current.set(id, { title, value });

    // fullscreen이면 dockview 컨테이너에서 마진만 남기고 가득 채운다(모달 전체화면 대체).
    // 아니면 살짝 겹치게 계단식으로 띄운다.
    const FULLSCREEN_MARGIN = 24;
    const floating = options?.fullscreen
      ? {
          width: Math.max(320, api.width - FULLSCREEN_MARGIN * 2),
          height: Math.max(240, api.height - FULLSCREEN_MARGIN * 2),
          x: FULLSCREEN_MARGIN,
          y: FULLSCREEN_MARGIN,
        }
      : { width: 560, height: 420, x: 80 + seq * 24, y: 60 + seq * 24 };

    api.addPanel({
      id,
      component: 'json',
      title,
      params: { dataId: id },
      floating,
    });
    api.getPanel(id)?.api.setActive();
  }, []);

  const getJsonPanelData = useCallback(
    (dataId: string) => jsonPanelDataRef.current.get(dataId),
    [],
  );

  // 도킹된(탭) 패널을 플로팅 창으로 분리한다. 이미 떠 있는 패널은 중앙에 다시 띄우지 않는다.
  const floatPanel = useCallback((mode: WorkspaceMode) => {
    const api = dockApiRef.current;
    if (!api) return;

    const panel = api.getPanel(mode);
    if (!panel || panel.api.location.type === 'floating') {
      panel?.api.setActive();
      return;
    }

    const FLOAT_MARGIN = 48;
    const width = Math.max(360, Math.min(760, api.width - FLOAT_MARGIN * 2));
    const height = Math.max(280, Math.min(560, api.height - FLOAT_MARGIN * 2));
    const x = Math.max(0, (api.width - width) / 2);
    const y = Math.max(0, (api.height - height) / 2);

    api.addFloatingGroup(panel, { x, y, width, height });
    panel.api.setActive();
  }, []);

  const handleActivePanelChange = useCallback((mode: WorkspaceMode) => {
    setWorkspaceMode(mode);
  }, [setWorkspaceMode]);

  // 툴바에서 뷰 버튼을 누르면 해당 패널을 열거나 포커스한다(active 패널 = 툴바 컨텍스트).
  const handleWorkspaceModeChange = useCallback((mode: WorkspaceMode) => {
    setWorkspaceMode(mode);
    if (dockApiRef.current) focusOrOpenWorkspacePanel(dockApiRef.current, mode);
  }, [setWorkspaceMode]);

  const handleResetLayout = useCallback(() => {
    if (!dockApiRef.current) return;
    clearDockLayout();
    buildDefaultWorkspaceLayout(dockApiRef.current);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedRequestId(null);
  }, []);

  const handleSelectRequest = useCallback(
    (requestId: string) => {
      if (networkSearchText.trim()) {
        const matchIndex = getSearchMatchIndexForRequest(networkOccurrences, requestId);
        if (matchIndex !== null) {
          networkSearch.setMatchIndex(matchIndex);
        }
      }

      setSelectedRequestId(requestId);
    },
    [networkOccurrences, networkSearch.setMatchIndex, networkSearchText],
  );

  const applyResponseContent = useCallback((requestId: string, content: string | null) => {
    setRequests((current) =>
      current.map((request) => {
        if (request.id !== requestId) return request;

        const resolved = content || 'Response body is not available.';
        return {
          ...request,
          responseContent: resolved,
          responsePreview: parseResponseContent(content || '', request.mimeType),
        };
      }),
    );
  }, [setRequests]);

  const fetchResponseContent = useCallback(
    (requestId: string, onComplete?: () => void) => {
      const networkRequest = networkRequestById.current.get(requestId);
      if (!networkRequest) {
        applyResponseContent(requestId, null);
        onComplete?.();
        return;
      }

      networkRequest.getContent((content) => {
        applyResponseContent(requestId, content);
        onComplete?.();
      });
    },
    [applyResponseContent, networkRequestById],
  );

  const getResponseContentForExport = useCallback(
    (request: ApiRequest): Promise<ApiRequest> => {
      if (request.responseContent !== undefined) {
        return Promise.resolve(request);
      }

      const networkRequest = networkRequestById.current.get(request.id);
      if (!networkRequest) {
        const resolved = 'Response body is not available.';
        return Promise.resolve({
          ...request,
          responseContent: resolved,
          responsePreview: parseResponseContent('', request.mimeType),
        });
      }

      return new Promise((resolve) => {
        networkRequest.getContent((content) => {
          const resolved = content || 'Response body is not available.';
          resolve({
            ...request,
            responseContent: resolved,
            responsePreview: parseResponseContent(content || '', request.mimeType),
          });
        });
      });
    },
    [networkRequestById],
  );

  const startResponseBodyLoad = useCallback(
    (requestId: string) => {
      const target = requests.find((request) => request.id === requestId);
      if (!target || target.responseContent !== undefined) return;
      if (bodyLoadingId === requestId) return;
      if (preloadInFlightRef.current.has(requestId)) return;

      setBodyLoadingId(requestId);
      fetchResponseContent(requestId, () => {
        setBodyLoadingId((current) => (current === requestId ? null : current));
      });
    },
    [bodyLoadingId, fetchResponseContent, requests],
  );

  // 이미지 썸네일용: 상세 패널 스피너(bodyLoadingId)를 건드리지 않고 본문만 채운다.
  // 여러 이미지 행이 동시에 요청될 수 있으므로 in-flight 집합으로 중복을 막는다.
  const ensureResponseBody = useCallback(
    (requestId: string) => {
      const target = requests.find((request) => request.id === requestId);
      if (!target || target.responseContent !== undefined) return;
      if (preloadInFlightRef.current.has(requestId)) return;
      if (!networkRequestById.current.has(requestId)) return;

      preloadInFlightRef.current.add(requestId);
      fetchResponseContent(requestId, () => {
        preloadInFlightRef.current.delete(requestId);
      });
    },
    [fetchResponseContent, networkRequestById, requests],
  );

  const drainPreloadQueue = useCallback(() => {
    while (preloadInFlightRef.current.size < PRELOAD_CONCURRENCY && preloadQueueRef.current.length > 0) {
      const requestId = preloadQueueRef.current.shift();
      if (!requestId || preloadInFlightRef.current.has(requestId)) continue;

      preloadInFlightRef.current.add(requestId);
      fetchResponseContent(requestId, () => {
        preloadInFlightRef.current.delete(requestId);
        drainPreloadQueue();
      });
    }
  }, [fetchResponseContent]);

  const handleExportSession = useCallback(async () => {
    if (!requests.length) return;
    const pendingBodyCount = requests.filter(
      (request) => request.responseContent === undefined,
    ).length;

    if (pendingBodyCount > 0) {
      setSessionNotice(`Collecting ${pendingBodyCount} response bodies...`);
    }

    const hydratedRequests = await Promise.all(
      requests.map((request) => getResponseContentForExport(request)),
    );

    setRequests(hydratedRequests);
    exportSession(hydratedRequests, flowLayoutRef.current);
    setSessionNotice(`Exported ${hydratedRequests.length} requests.`);
  }, [getResponseContentForExport, requests, setRequests]);

  const handleImportSession = useCallback(async () => {
    try {
      const content = await pickSessionFile();
      const { requests: importedRequests, flowLayout } = parseSession(content);
      networkRequestById.current.clear();
      setRequests(importedRequests);
      setSelectedRequestId(importedRequests[0]?.id ?? null);
      setNetworkSearchText('');
      networkSearch.setMatchIndex(0);
      const nextFlowLayout = flowLayout ?? EMPTY_FLOW_LAYOUT;
      flowLayoutRef.current = nextFlowLayout;
      setFlowLayoutRevision((revision) => revision + 1);
      setSessionNotice(`Imported ${importedRequests.length} requests.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import session.';
      setSessionNotice(message);
    }
  }, [networkRequestById, networkSearch.setMatchIndex, setNetworkSearchText, setRequests]);

  const loadResponseBody = useCallback(
    (requestId: string) => {
      const target = requests.find((request) => request.id === requestId);
      if (!target) return;
      if (bodyLoadingId === requestId) return;

      setBodyLoadingId(requestId);
      fetchResponseContent(requestId, () => {
        setBodyLoadingId((current) => (current === requestId ? null : current));
      });
    },
    [bodyLoadingId, fetchResponseContent, requests],
  );

  const handleSelectRequestWithBodyLoad = useCallback(
    (requestId: string) => {
      // 같은 행을 다시 누르면 세부 패널을 닫는다(토글).
      if (requestId === selectedRequestId) {
        setSelectedRequestId(null);
        return;
      }
      handleSelectRequest(requestId);
      startResponseBodyLoad(requestId);
    },
    [handleSelectRequest, selectedRequestId, startResponseBodyLoad],
  );

  // 행 컨텍스트 메뉴의 즉시 재전송. 편집 흐름(ReplayEditorModal)은 상세 패널에 남는다.
  // 결과는 세션 알림 줄로 알린다 — 재전송된 요청 자체는 새 항목으로 목록에 잡힌다.
  const handleResendRequest = useCallback(
    async (requestId: string) => {
      const target = requests.find((request) => request.id === requestId);
      if (!target) return;
      if (!canResendRequest(target)) {
        setSessionNotice(t('common.resendUnsupported'));
        return;
      }

      setSessionNotice(t('resend.sending', { method: target.method, path: target.path }));
      const outcome = await resendRequest(buildReplayDraft(target));
      if (outcome.ok) {
        setSessionNotice(t('resend.sent', { method: target.method, path: target.path }));
      } else {
        const error = outcome.errorKey ? t(outcome.errorKey) : outcome.error ?? '';
        setSessionNotice(t('resend.failed', { error }));
      }
    },
    [requests, t],
  );

  useEffect(() => {
    if (!networkSearchText.trim()) {
      preloadQueueRef.current = [];
      return;
    }

    const queued = new Set(preloadQueueRef.current);
    const pendingIds = filteredRequests
      .filter(
        (request) =>
          request.responseContent === undefined &&
          networkRequestById.current.has(request.id) &&
          !preloadInFlightRef.current.has(request.id) &&
          !queued.has(request.id),
      )
      .map((request) => request.id)
      .slice(0, PRELOAD_MAX);

    for (const requestId of pendingIds) {
      preloadQueueRef.current.push(requestId);
      queued.add(requestId);
    }

    drainPreloadQueue();
  }, [drainPreloadQueue, filteredRequests, networkRequestById, networkSearchText]);

  useEffect(() => {
    if (!selectedRequest) return;
    startResponseBodyLoad(selectedRequest.id);
  }, [selectedRequest, startResponseBodyLoad]);

  const searchModels: WorkspaceContextValue['searchModels'] = {
    network: networkSearch.toModel({
      scopeLabel: 'Card',
      placeholder: 'Search path, status, body…',
    }),
    storage: storageSearch.toModel({
      scopeLabel: 'Row',
      placeholder: 'Search key, value…',
    }),
    console: consoleSearch.toModel({
      scopeLabel: 'Log',
      placeholder: 'Search logs, objects, stack…',
    }),
  };

  const filterModels: WorkspaceContextValue['filterModels'] = {
    network: {
      includeText: networkIncludeText,
      excludeText: networkExcludeText,
      onIncludeTextChange: setNetworkIncludeText,
      onExcludeTextChange: setNetworkExcludeText,
      includePlaceholder: 'api, graphql',
      excludePlaceholder: 'analytics, sentry',
    },
    storage: {
      includeText: storageIncludeText,
      excludeText: storageExcludeText,
      onIncludeTextChange: setStorageIncludeText,
      onExcludeTextChange: setStorageExcludeText,
      includePlaceholder: 'token, auth',
      excludePlaceholder: 'analytics, cache',
    },
    console: {
      includeText: consoleIncludeText,
      excludeText: consoleExcludeText,
      onIncludeTextChange: setConsoleIncludeText,
      onExcludeTextChange: setConsoleExcludeText,
      includePlaceholder: 'error, warn',
      excludePlaceholder: 'debug, vite',
    },
  };

  const workspaceValue: WorkspaceContextValue = {
    searchModels,
    filterModels,
    searchOptions: {
      matchCase: searchMatchCase,
      wholeWord: searchWholeWord,
      onMatchCaseChange: setSearchMatchCase,
      onWholeWordChange: setSearchWholeWord,
    },
    activeMode: workspaceMode,
    networkViewMode,
    timelineItems,
    displayedRequests,
    selectedRequestId,
    groupFlowByTime,
    clearNetworkOnReload,
    onClearNetworkOnReloadChange: setClearNetworkOnReload,
    collapsePathIds,
    enabledResourceKinds: resourceKinds.enabled,
    onToggleResourceKind: resourceKinds.toggle,
    onSetAllResourceKinds: resourceKinds.setAll,
    enabledStatusGroups: statusGroups.enabled,
    onToggleStatusGroup: statusGroups.toggle,
    onSetAllStatusGroups: statusGroups.setAll,
    enabledMethods: methods.enabled,
    onToggleMethod: methods.toggle,
    onSetAllMethods: methods.setAll,
    networkSearchText,
    searchOccurrenceByRequest: networkSearch.summary,
    activeGlobalSearchIndex: networkSearch.activeGlobalIndex,
    flowLayoutRevision,
    flowLayoutSnapshot: flowLayoutRef.current,
    onSelectRequest: handleSelectRequestWithBodyLoad,
    onResendRequest: (requestId) => {
      void handleResendRequest(requestId);
    },
    onFlowLayoutChange: handleFlowLayoutChange,
    onNetworkViewModeChange: setNetworkViewMode,
    onGroupFlowByTimeChange: setGroupFlowByTime,
    onCollapsePathIdsChange: setCollapsePathIds,
    onExportSession: handleExportSession,
    onImportSession: () => {
      void handleImportSession();
    },
    onClear: handleClear,
    canExport: requests.length > 0,
    canClear: displayedRequests.length > 0,
    sessionNotice,
    selectedRequest,
    bodyLoadingId,
    networkSearchMatchIndex: networkSearch.matchIndex,
    activeSearchOccurrence: networkSearch.activeOccurrence,
    onLoadResponseBody: loadResponseBody,
    onEnsureThumbnailBody: ensureResponseBody,
    onCloseDetail: handleCloseDetail,
    openJsonPanel,
    getJsonPanelData,
    floatPanel,
    storageSearchText,
    storageSearchMatchIndex: storageSearch.matchIndex,
    storageIncludeText,
    storageExcludeText,
    onStorageSearchOccurrencesChange: setStorageOccurrences,
    onStorageSearchMatchIndexChange: storageSearch.setMatchIndex,
    consoleEntries,
    selectedConsoleEntryId,
    consoleSearchText,
    consoleIncludeText,
    consoleExcludeText,
    consoleSearchMatchIndex: consoleSearch.matchIndex,
    enabledConsoleLevels: consoleLevels.enabled,
    onToggleConsoleLevel: consoleLevels.toggle,
    onSetAllConsoleLevels: consoleLevels.setAll,
    onConsoleEntriesChange: setConsoleEntries,
    onConsoleSelectedEntryIdChange: setSelectedConsoleEntryId,
    onConsoleSearchOccurrencesChange: setConsoleOccurrences,
    onConsoleSearchMatchIndexChange: consoleSearch.setMatchIndex,
  };

  return (
    <SearchOptionsProvider value={searchOptions}>
    <main className="grid h-screen grid-rows-[auto_1fr] overflow-hidden">
      <Toolbar
        requestCount={isConsoleMode ? consoleShownCount : displayedRequests.length}
        totalRequestCount={isConsoleMode ? displayedConsoleEntries.length : requests.length}
        workspaceMode={workspaceMode}
        openPanels={openPanels}
        onWorkspaceModeChange={handleWorkspaceModeChange}
        onResetLayout={handleResetLayout}
        clearNetworkOnReload={clearNetworkOnReload}
        onClearNetworkOnReloadChange={setClearNetworkOnReload}
      />
      <WorkspaceProvider value={workspaceValue}>
        <WorkspaceDock
          onApiReady={handleDockApiReady}
          onActivePanelChange={handleActivePanelChange}
          onOpenPanelsChange={setOpenPanels}
        />
      </WorkspaceProvider>
    </main>
    </SearchOptionsProvider>
  );
}
