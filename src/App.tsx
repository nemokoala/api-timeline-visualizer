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
import type { ConsoleEntry } from './types/console';
import type { DevtoolsNetworkRequest } from './types/chrome-har';
import type { ApiRequest } from './types/network';
import {
  canInspectConsole,
  drainConsoleEntries,
  getConsolePollInterval,
  installConsoleCapture,
} from './utils/consoleInspector';
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
import {
  matchesTextFilters,
  parseNetworkRequest,
  parseResponseContent,
  shouldCollectRequest,
} from './utils/requestParser';
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
  getGroupFlowByTime,
  getNetworkViewMode,
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
  getEnabledMethods,
  getStatusFilter,
  matchesMethodFilter,
  matchesStatusFilter,
  saveEnabledMethods,
  saveStatusFilter,
  type FilterableMethod,
  type StatusFilter,
} from './utils/requestFilterPrefs';
import { getMockConsoleEntries, getMockRequests, shouldUseMockData } from './mocks/mockData';
import { usePersistedState } from './hooks/usePersistedState';
import { useSearchNavigation } from './hooks/useSearchNavigation';

const PRELOAD_CONCURRENCY = 4;
const PRELOAD_MAX = 100;

export default function App() {
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  // 세션 import 후 FlowChartView가 저장된 레이아웃을 다시 읽도록 알리는 신호값.
  const [flowLayoutRevision, setFlowLayoutRevision] = useState(0);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [bodyLoadingId, setBodyLoadingId] = useState<string | null>(null);
  const [workspaceMode, setWorkspaceMode] = usePersistedState<WorkspaceMode>(getWorkspaceMode, saveWorkspaceMode);
  const [networkViewMode, setNetworkViewMode] = usePersistedState<NetworkViewMode>(getNetworkViewMode, saveNetworkViewMode);
  const [groupFlowByTime, setGroupFlowByTime] = usePersistedState(getGroupFlowByTime, saveGroupFlowByTime);
  const [enabledResourceKinds, setEnabledResourceKinds] = usePersistedState<ToggleableResourceKind[]>(
    getEnabledResourceKinds,
    saveEnabledResourceKinds,
  );
  const [statusFilter, setStatusFilter] = usePersistedState<StatusFilter>(getStatusFilter, saveStatusFilter);
  const [enabledMethods, setEnabledMethods] = usePersistedState<FilterableMethod[]>(
    getEnabledMethods,
    saveEnabledMethods,
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
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [selectedConsoleEntryId, setSelectedConsoleEntryId] = useState<string | null>(null);
  const [storageSearchOccurrences, setStorageSearchOccurrences] = useState<StorageSearchOccurrence[]>([]);
  const [consoleSearchOccurrences, setConsoleSearchOccurrences] = useState<ConsoleSearchOccurrence[]>([]);
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
  const networkRequestById = useRef(new Map<string, chrome.devtools.network.Request>());
  const preloadQueueRef = useRef<string[]>([]);
  const preloadInFlightRef = useRef(new Set<string>());

  const searchOptions = useMemo(
    () => ({ matchCase: searchMatchCase, matchWholeWord: searchWholeWord }),
    [searchMatchCase, searchWholeWord],
  );

  const isConsoleMode = workspaceMode === 'console';

  const enabledResourceKindSet = useMemo(
    () => new Set<ToggleableResourceKind>(enabledResourceKinds),
    [enabledResourceKinds],
  );

  const filteredRequests = useMemo(
    () =>
      requests.filter(
        (request) =>
          // 토글 대상 종류는 켜졌을 때만 표시, 그 외('other' 등)는 항상 표시.
          (!isToggleableResourceKind(request.type) || enabledResourceKindSet.has(request.type)) &&
          matchesStatusFilter(request, statusFilter) &&
          matchesMethodFilter(request, enabledMethods) &&
          matchesTextFilters(request, networkIncludeText, networkExcludeText),
      ),
    [enabledMethods, enabledResourceKindSet, networkExcludeText, networkIncludeText, requests, statusFilter],
  );

  const searchOccurrences = useMemo(() => {
    if (!networkSearchText.trim()) return [];
    return buildSearchOccurrences(filteredRequests, networkSearchText, searchOptions);
  }, [filteredRequests, networkSearchText, searchOptions]);

  const {
    matchIndex: networkSearchMatchIndex,
    setMatchIndex: setNetworkSearchMatchIndex,
    goToMatch: goToNetworkSearchMatch,
    goToScope: goToNetworkSearchRequest,
  } = useSearchNavigation(searchOccurrences, networkSearchText, searchOptions, getNextRequestJumpIndex);
  const {
    matchIndex: storageSearchMatchIndex,
    setMatchIndex: setStorageSearchMatchIndex,
    goToMatch: goToStorageSearchMatch,
    goToScope: goToStorageSearchItem,
  } = useSearchNavigation(storageSearchOccurrences, storageSearchText, searchOptions, getNextStorageItemJumpIndex);
  const {
    matchIndex: consoleSearchMatchIndex,
    setMatchIndex: setConsoleSearchMatchIndex,
    goToMatch: goToConsoleSearchMatch,
    goToScope: goToConsoleSearchEntry,
  } = useSearchNavigation(consoleSearchOccurrences, consoleSearchText, searchOptions, getNextConsoleEntryJumpIndex);

  const activeSearchOccurrence = searchOccurrences[networkSearchMatchIndex] ?? null;
  const searchOccurrenceByRequest = useMemo(
    () => buildSearchOccurrenceSummaryByRequest(searchOccurrences),
    [searchOccurrences],
  );
  const activeGlobalSearchIndex =
    networkSearchText.trim() && searchOccurrences.length > 0 ? networkSearchMatchIndex + 1 : null;
  const searchRequestJumpCount = searchOccurrenceByRequest.size;
  const activeSearchRequestOrder = activeSearchOccurrence
    ? (searchOccurrenceByRequest.get(activeSearchOccurrence.requestId)?.requestOrder ?? 0)
    : 0;
  const storageOccurrenceByItem = useMemo(
    () => buildStorageOccurrenceSummaryByItem(storageSearchOccurrences),
    [storageSearchOccurrences],
  );
  const activeStorageSearchOccurrence = storageSearchOccurrences[storageSearchMatchIndex] ?? null;
  const storageSearchRequestJumpCount = storageOccurrenceByItem.size;
  const activeStorageItemOrder = activeStorageSearchOccurrence
    ? (storageOccurrenceByItem.get(storageTargetKey(activeStorageSearchOccurrence.target))?.itemOrder ?? 0)
    : 0;
  const consoleOccurrenceByEntry = useMemo(
    () => buildConsoleOccurrenceSummaryByEntry(consoleSearchOccurrences),
    [consoleSearchOccurrences],
  );
  const activeConsoleSearchOccurrence = consoleSearchOccurrences[consoleSearchMatchIndex] ?? null;
  const consoleSearchEntryJumpCount = consoleOccurrenceByEntry.size;
  const activeConsoleEntryOrder = activeConsoleSearchOccurrence
    ? (consoleOccurrenceByEntry.get(activeConsoleSearchOccurrence.entryId)?.entryOrder ?? 0)
    : 0;
  const displayedConsoleEntries = useMemo(
    () => consoleEntries.filter((entry) => entry.level !== 'clear'),
    [consoleEntries],
  );
  const displayedRequests = filteredRequests;
  const selectedRequest = displayedRequests.find((request) => request.id === selectedRequestId) ?? null;
  const timelineItems = useMemo(() => toTimelineItems(displayedRequests), [displayedRequests]);

  useEffect(() => {
    if (!selectedRequestId) return;
    if (displayedRequests.some((request) => request.id === selectedRequestId)) return;
    setSelectedRequestId(null);
  }, [displayedRequests, selectedRequestId]);

  useEffect(() => {
    if (!networkSearchText.trim() || !searchOccurrences.length) return;

    const clampedIndex = networkSearchMatchIndex % searchOccurrences.length;
    if (clampedIndex !== networkSearchMatchIndex) {
      setNetworkSearchMatchIndex(clampedIndex);
      return;
    }

    const activeOccurrence = searchOccurrences[clampedIndex];
    if (activeOccurrence) setSelectedRequestId(activeOccurrence.requestId);
  }, [networkSearchMatchIndex, networkSearchText, searchOccurrences]);

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

  useEffect(() => {
    if (!canInspectConsole()) return;

    let cancelled = false;
    let captureInstalled = false;

    const poll = async () => {
      if (cancelled) return;

      try {
        if (!captureInstalled) {
          await installConsoleCapture(true);
          captureInstalled = true;
        }
        const { installed, entries: drained } = await drainConsoleEntries();
        // 페이지가 새로고침/이동되면 주입한 훅이 사라진다. 이 경우 drain은 예외 없이
        // installed=false를 돌려주므로, 플래그를 리셋해 다음 틱에 재설치한다.
        // (이 처리가 없으면 콘솔이 조용히 영영 비어버린다.)
        if (!installed) {
          captureInstalled = false;
          return;
        }
        if (drained.length) {
          setConsoleEntries((current) => [...current, ...drained]);
        }
      } catch {
        // Page reloading — reset flag so capture is reinstalled on next poll.
        captureInstalled = false;
      }
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, getConsolePollInterval());

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.devtools?.network) return;

    const handleRequestFinished = (request: chrome.devtools.network.Request) => {
      const networkRequest = request as DevtoolsNetworkRequest;
      if (!shouldCollectRequest(networkRequest)) return;

      const parsed = parseNetworkRequest(networkRequest);
      networkRequestById.current.set(parsed.id, request);
      setRequests((current) => [...current.slice(-999), parsed]);
    };

    chrome.devtools.network.onRequestFinished.addListener(handleRequestFinished);

    return () => {
      chrome.devtools.network.onRequestFinished.removeListener(handleRequestFinished);
    };
  }, []);

  // 로컬 개발(npm run dev): DevTools 컨텍스트가 아니라 실데이터 소스가 없으므로 목업을 주입한다.
  // 확장 프로그램 빌드에서는 shouldUseMockData()가 false라 실행되지 않는다.
  useEffect(() => {
    if (!shouldUseMockData()) return;
    setRequests(getMockRequests());
    setConsoleEntries(getMockConsoleEntries());
  }, []);

  const handleClear = useCallback(() => {
    networkRequestById.current.clear();
    setRequests([]);
    setSelectedRequestId(null);
    setNetworkSearchText('');
    setNetworkSearchMatchIndex(0);
    flowLayoutRef.current = EMPTY_FLOW_LAYOUT;
    setFlowLayoutRevision((revision) => revision + 1);
  }, []);

  const handleToggleResourceKind = useCallback((kind: ToggleableResourceKind, enabled: boolean) => {
    setEnabledResourceKinds((current) => {
      const next = enabled ? [...current, kind] : current.filter((item) => item !== kind);
      // 저장 순서를 표준 순서로 정규화하고 중복을 제거한다.
      return TOGGLEABLE_RESOURCE_KINDS.filter((item) => next.includes(item));
    });
  }, []);

  const handleToggleMethod = useCallback((method: FilterableMethod, enabled: boolean) => {
    setEnabledMethods((current) => {
      const next = enabled ? [...current, method] : current.filter((item) => item !== method);
      return FILTERABLE_METHODS.filter((item) => next.includes(item));
    });
  }, []);

  const handleFlowLayoutChange = useCallback((layout: FlowLayout) => {
    flowLayoutRef.current = layout;
  }, []);

  const handleDockApiReady = useCallback((api: DockviewApi) => {
    dockApiRef.current = api;
  }, []);

  const openJsonPanel = useCallback((value: unknown) => {
    const api = dockApiRef.current;
    if (!api) return;

    const seq = (jsonPanelSeqRef.current += 1);
    const id = `json:${seq}`;
    const title = `JSON ${seq}`;
    jsonPanelDataRef.current.set(id, { title, value });

    api.addPanel({
      id,
      component: 'json',
      title,
      params: { dataId: id },
      floating: { width: 560, height: 420, x: 80 + seq * 24, y: 60 + seq * 24 },
    });
    api.getPanel(id)?.api.setActive();
  }, []);

  const getJsonPanelData = useCallback(
    (dataId: string) => jsonPanelDataRef.current.get(dataId),
    [],
  );

  const handleActivePanelChange = useCallback((mode: WorkspaceMode) => {
    setWorkspaceMode(mode);
  }, []);

  // 툴바에서 뷰 버튼을 누르면 해당 패널을 열거나 포커스한다(active 패널 = 툴바 컨텍스트).
  const handleWorkspaceModeChange = useCallback((mode: WorkspaceMode) => {
    setWorkspaceMode(mode);
    if (dockApiRef.current) focusOrOpenWorkspacePanel(dockApiRef.current, mode);
  }, []);

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
        const matchIndex = getSearchMatchIndexForRequest(searchOccurrences, requestId);
        if (matchIndex !== null) {
          setNetworkSearchMatchIndex(matchIndex);
        }
      }

      setSelectedRequestId(requestId);
    },
    [networkSearchText, searchOccurrences],
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
  }, []);

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
    [applyResponseContent],
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
    [],
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
    [fetchResponseContent, requests],
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
  }, [getResponseContentForExport, requests]);

  const handleImportSession = useCallback(async () => {
    try {
      const content = await pickSessionFile();
      const { requests: importedRequests, flowLayout } = parseSession(content);
      networkRequestById.current.clear();
      setRequests(importedRequests);
      setSelectedRequestId(importedRequests[0]?.id ?? null);
      setNetworkSearchText('');
      setNetworkSearchMatchIndex(0);
      const nextFlowLayout = flowLayout ?? EMPTY_FLOW_LAYOUT;
      flowLayoutRef.current = nextFlowLayout;
      setFlowLayoutRevision((revision) => revision + 1);
      setSessionNotice(`Imported ${importedRequests.length} requests.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import session.';
      setSessionNotice(message);
    }
  }, []);

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
  }, [drainPreloadQueue, filteredRequests, networkSearchText]);

  useEffect(() => {
    if (!selectedRequest) return;
    startResponseBodyLoad(selectedRequest.id);
  }, [selectedRequest, startResponseBodyLoad]);

  const searchModels: WorkspaceContextValue['searchModels'] = {
    network: {
      searchText: networkSearchText,
      onSearchTextChange: setNetworkSearchText,
      occurrenceCount: searchOccurrences.length,
      matchIndex: networkSearchMatchIndex,
      scopeJumpCount: searchRequestJumpCount,
      activeScopeOrder: activeSearchRequestOrder,
      scopeLabel: 'Card',
      placeholder: 'Search path, status, body…',
      onNext: () => goToNetworkSearchMatch(1),
      onPrevious: () => goToNetworkSearchMatch(-1),
      onNextScope: () => goToNetworkSearchRequest(1),
      onPreviousScope: () => goToNetworkSearchRequest(-1),
    },
    storage: {
      searchText: storageSearchText,
      onSearchTextChange: setStorageSearchText,
      occurrenceCount: storageSearchOccurrences.length,
      matchIndex: storageSearchMatchIndex,
      scopeJumpCount: storageSearchRequestJumpCount,
      activeScopeOrder: activeStorageItemOrder,
      scopeLabel: 'Row',
      placeholder: 'Search key, value…',
      onNext: () => goToStorageSearchMatch(1),
      onPrevious: () => goToStorageSearchMatch(-1),
      onNextScope: () => goToStorageSearchItem(1),
      onPreviousScope: () => goToStorageSearchItem(-1),
    },
    console: {
      searchText: consoleSearchText,
      onSearchTextChange: setConsoleSearchText,
      occurrenceCount: consoleSearchOccurrences.length,
      matchIndex: consoleSearchMatchIndex,
      scopeJumpCount: consoleSearchEntryJumpCount,
      activeScopeOrder: activeConsoleEntryOrder,
      scopeLabel: 'Log',
      placeholder: 'Search logs, objects, stack…',
      onNext: () => goToConsoleSearchMatch(1),
      onPrevious: () => goToConsoleSearchMatch(-1),
      onNextScope: () => goToConsoleSearchEntry(1),
      onPreviousScope: () => goToConsoleSearchEntry(-1),
    },
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
    enabledResourceKinds,
    onToggleResourceKind: handleToggleResourceKind,
    statusFilter,
    onStatusFilterChange: setStatusFilter,
    enabledMethods,
    onToggleMethod: handleToggleMethod,
    networkSearchText,
    searchOccurrenceByRequest,
    activeGlobalSearchIndex,
    flowLayoutRevision,
    flowLayoutSnapshot: flowLayoutRef.current,
    onSelectRequest: handleSelectRequestWithBodyLoad,
    onFlowLayoutChange: handleFlowLayoutChange,
    onNetworkViewModeChange: setNetworkViewMode,
    onGroupFlowByTimeChange: setGroupFlowByTime,
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
    networkSearchMatchIndex,
    activeSearchOccurrence,
    onLoadResponseBody: loadResponseBody,
    onEnsureThumbnailBody: ensureResponseBody,
    onCloseDetail: handleCloseDetail,
    openJsonPanel,
    getJsonPanelData,
    storageSearchText,
    storageSearchMatchIndex,
    storageIncludeText,
    storageExcludeText,
    onStorageSearchOccurrencesChange: setStorageSearchOccurrences,
    onStorageSearchMatchIndexChange: setStorageSearchMatchIndex,
    consoleEntries,
    selectedConsoleEntryId,
    consoleSearchText,
    consoleIncludeText,
    consoleExcludeText,
    consoleSearchMatchIndex,
    onConsoleEntriesChange: setConsoleEntries,
    onConsoleSelectedEntryIdChange: setSelectedConsoleEntryId,
    onConsoleSearchOccurrencesChange: setConsoleSearchOccurrences,
    onConsoleSearchMatchIndexChange: setConsoleSearchMatchIndex,
  };

  return (
    <SearchOptionsProvider value={searchOptions}>
    <main className="app-shell">
      <Toolbar
        requestCount={isConsoleMode ? displayedConsoleEntries.length : displayedRequests.length}
        totalRequestCount={isConsoleMode ? displayedConsoleEntries.length : requests.length}
        workspaceMode={workspaceMode}
        openPanels={openPanels}
        onWorkspaceModeChange={handleWorkspaceModeChange}
        onResetLayout={handleResetLayout}
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
