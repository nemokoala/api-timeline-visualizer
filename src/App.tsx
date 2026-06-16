import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConsoleView } from './components/ConsoleView';
import { FlowChartView } from './components/FlowChartView';
import { RequestDetailPanel } from './components/RequestDetailPanel';
import { SplitPanelResizer } from './components/SplitPanelResizer';
import { StorageView } from './components/StorageView';
import { TimelineView } from './components/TimelineView';
import { SearchOptionsProvider } from './contexts/SearchOptionsContext';
import { Toolbar, type NetworkViewMode, type WorkspaceMode } from './components/Toolbar';
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
  loadFlowLayout,
  saveFlowLayout,
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
import { useSplitPanelLayout } from './hooks/useSplitPanelLayout';
import { toTimelineItems } from './utils/timeline';
import {
  getGroupFlowByTime,
  getNetworkViewMode,
  saveGroupFlowByTime,
  saveNetworkViewMode,
} from './utils/networkFlowPrefs';
import { getWorkspaceMode, saveWorkspaceMode } from './utils/workspacePrefs';

const PRELOAD_CONCURRENCY = 4;
const PRELOAD_MAX = 100;

export default function App() {
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  // 세션 import 후 FlowChartView가 저장된 레이아웃을 다시 읽도록 알리는 신호값.
  const [flowLayoutRevision, setFlowLayoutRevision] = useState(0);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [bodyLoadingId, setBodyLoadingId] = useState<string | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(() => getWorkspaceMode());
  const [networkViewMode, setNetworkViewMode] = useState<NetworkViewMode>(() => getNetworkViewMode());
  const [groupFlowByTime, setGroupFlowByTime] = useState(() => getGroupFlowByTime());
  const [networkIncludeText, setNetworkIncludeText] = useState(() => getNetworkIncludeText());
  const [networkExcludeText, setNetworkExcludeText] = useState(() => getNetworkExcludeText());
  const [storageIncludeText, setStorageIncludeText] = useState(() => getStorageIncludeText());
  const [storageExcludeText, setStorageExcludeText] = useState(() => getStorageExcludeText());
  const [consoleIncludeText, setConsoleIncludeText] = useState(() => getConsoleIncludeText());
  const [consoleExcludeText, setConsoleExcludeText] = useState(() => getConsoleExcludeText());
  const [networkSearchText, setNetworkSearchText] = useState(() => getNetworkSearchText());
  const [storageSearchText, setStorageSearchText] = useState(() => getStorageSearchText());
  const [consoleSearchText, setConsoleSearchText] = useState(() => getConsoleSearchText());
  const [searchMatchCase, setSearchMatchCase] = useState(() => getSearchMatchCase());
  const [searchWholeWord, setSearchWholeWord] = useState(() => getSearchWholeWord());
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [selectedConsoleEntryId, setSelectedConsoleEntryId] = useState<string | null>(null);
  const [networkSearchMatchIndex, setNetworkSearchMatchIndex] = useState(0);
  const [storageSearchMatchIndex, setStorageSearchMatchIndex] = useState(0);
  const [consoleSearchMatchIndex, setConsoleSearchMatchIndex] = useState(0);
  const [storageSearchOccurrences, setStorageSearchOccurrences] = useState<StorageSearchOccurrence[]>([]);
  const [consoleSearchOccurrences, setConsoleSearchOccurrences] = useState<ConsoleSearchOccurrence[]>([]);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const {
    isStacked: isSplitStacked,
    layoutStyle: splitLayoutStyle,
    startWidthResize,
    startHeightResize,
    resetWidth: resetSplitWidth,
    resetHeight: resetSplitHeight,
    toggleSplitLayout,
  } = useSplitPanelLayout(workspaceRef);
  const networkRequestById = useRef(new Map<string, chrome.devtools.network.Request>());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const preloadQueueRef = useRef<string[]>([]);
  const preloadInFlightRef = useRef(new Set<string>());

  useEffect(() => {
    saveNetworkIncludeText(networkIncludeText);
  }, [networkIncludeText]);

  useEffect(() => {
    saveNetworkExcludeText(networkExcludeText);
  }, [networkExcludeText]);

  useEffect(() => {
    saveStorageIncludeText(storageIncludeText);
  }, [storageIncludeText]);

  useEffect(() => {
    saveStorageExcludeText(storageExcludeText);
  }, [storageExcludeText]);

  useEffect(() => {
    saveConsoleIncludeText(consoleIncludeText);
  }, [consoleIncludeText]);

  useEffect(() => {
    saveConsoleExcludeText(consoleExcludeText);
  }, [consoleExcludeText]);

  useEffect(() => {
    saveNetworkSearchText(networkSearchText);
  }, [networkSearchText]);

  useEffect(() => {
    saveStorageSearchText(storageSearchText);
  }, [storageSearchText]);

  useEffect(() => {
    saveConsoleSearchText(consoleSearchText);
  }, [consoleSearchText]);

  useEffect(() => {
    saveWorkspaceMode(workspaceMode);
  }, [workspaceMode]);

  useEffect(() => {
    saveGroupFlowByTime(groupFlowByTime);
  }, [groupFlowByTime]);

  useEffect(() => {
    saveNetworkViewMode(networkViewMode);
  }, [networkViewMode]);

  useEffect(() => {
    saveSearchMatchCase(searchMatchCase);
  }, [searchMatchCase]);

  useEffect(() => {
    saveSearchWholeWord(searchWholeWord);
  }, [searchWholeWord]);

  const searchOptions = useMemo(
    () => ({ matchCase: searchMatchCase, matchWholeWord: searchWholeWord }),
    [searchMatchCase, searchWholeWord],
  );

  const isNetworkMode = workspaceMode === 'network';
  const isStorageMode = workspaceMode === 'storage';
  const isConsoleMode = workspaceMode === 'console';
  const activeSearchText = isNetworkMode
    ? networkSearchText
    : isStorageMode
      ? storageSearchText
      : consoleSearchText;
  const activeSearchMatchIndex = isNetworkMode
    ? networkSearchMatchIndex
    : isStorageMode
      ? storageSearchMatchIndex
      : consoleSearchMatchIndex;

  const filteredRequests = useMemo(
    () => requests.filter((request) => matchesTextFilters(request, networkIncludeText, networkExcludeText)),
    [networkExcludeText, networkIncludeText, requests],
  );

  const searchOccurrences = useMemo(() => {
    if (!networkSearchText.trim()) return [];
    return buildSearchOccurrences(filteredRequests, networkSearchText, searchOptions);
  }, [filteredRequests, networkSearchText, searchOptions]);

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
    setNetworkSearchMatchIndex(0);
  }, [networkSearchText]);

  useEffect(() => {
    setStorageSearchMatchIndex(0);
  }, [storageSearchText]);

  useEffect(() => {
    setConsoleSearchMatchIndex(0);
  }, [consoleSearchText]);

  useEffect(() => {
    setNetworkSearchMatchIndex(0);
    setStorageSearchMatchIndex(0);
    setConsoleSearchMatchIndex(0);
  }, [searchMatchCase, searchWholeWord]);

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
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  const handleClear = useCallback(() => {
    networkRequestById.current.clear();
    setRequests([]);
    setSelectedRequestId(null);
    setNetworkSearchText('');
    setNetworkSearchMatchIndex(0);
    saveFlowLayout(EMPTY_FLOW_LAYOUT);
    setFlowLayoutRevision((revision) => revision + 1);
  }, []);

  const handleSearchTextChange = useCallback(
    (value: string) => {
      if (workspaceMode === 'network') {
        setNetworkSearchText(value);
        return;
      }

      if (workspaceMode === 'storage') {
        setStorageSearchText(value);
        return;
      }

      setConsoleSearchText(value);
    },
    [workspaceMode],
  );

  const goToNetworkSearchMatch = useCallback(
    (direction: 1 | -1) => {
      if (!searchOccurrences.length) return;
      setNetworkSearchMatchIndex((current) => {
        const nextIndex = (current + direction + searchOccurrences.length) % searchOccurrences.length;
        return nextIndex;
      });
    },
    [searchOccurrences],
  );

  const goToNetworkSearchRequest = useCallback(
    (direction: 1 | -1) => {
      if (!searchOccurrences.length) return;
      setNetworkSearchMatchIndex((current) => {
        const nextIndex = getNextRequestJumpIndex(searchOccurrences, current, direction);
        return nextIndex ?? current;
      });
    },
    [searchOccurrences],
  );

  const goToStorageSearchMatch = useCallback(
    (direction: 1 | -1) => {
      if (!storageSearchOccurrences.length) return;
      setStorageSearchMatchIndex((current) => {
        const nextIndex =
          (current + direction + storageSearchOccurrences.length) % storageSearchOccurrences.length;
        return nextIndex;
      });
    },
    [storageSearchOccurrences],
  );

  const goToStorageSearchItem = useCallback(
    (direction: 1 | -1) => {
      if (!storageSearchOccurrences.length) return;
      setStorageSearchMatchIndex((current) => {
        const nextIndex = getNextStorageItemJumpIndex(storageSearchOccurrences, current, direction);
        return nextIndex ?? current;
      });
    },
    [storageSearchOccurrences],
  );

  const goToConsoleSearchMatch = useCallback(
    (direction: 1 | -1) => {
      if (!consoleSearchOccurrences.length) return;
      setConsoleSearchMatchIndex((current) => {
        const nextIndex =
          (current + direction + consoleSearchOccurrences.length) % consoleSearchOccurrences.length;
        return nextIndex;
      });
    },
    [consoleSearchOccurrences],
  );

  const goToConsoleSearchEntry = useCallback(
    (direction: 1 | -1) => {
      if (!consoleSearchOccurrences.length) return;
      setConsoleSearchMatchIndex((current) => {
        const nextIndex = getNextConsoleEntryJumpIndex(consoleSearchOccurrences, current, direction);
        return nextIndex ?? current;
      });
    },
    [consoleSearchOccurrences],
  );

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

  const handleExportSession = useCallback(() => {
    if (!requests.length) return;
    exportSession(requests, loadFlowLayout());
    setSessionNotice(`Exported ${requests.length} requests.`);
  }, [requests]);

  const handleImportSession = useCallback(async () => {
    try {
      const content = await pickSessionFile();
      const { requests: importedRequests, flowLayout } = parseSession(content);
      networkRequestById.current.clear();
      setRequests(importedRequests);
      setSelectedRequestId(importedRequests[0]?.id ?? null);
      setNetworkSearchText('');
      setNetworkSearchMatchIndex(0);
      saveFlowLayout(flowLayout ?? EMPTY_FLOW_LAYOUT);
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
      handleSelectRequest(requestId);
      startResponseBodyLoad(requestId);
    },
    [handleSelectRequest, startResponseBodyLoad],
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

  return (
    <SearchOptionsProvider value={searchOptions}>
    <main className="app-shell">
      <Toolbar
        requestCount={isConsoleMode ? displayedConsoleEntries.length : displayedRequests.length}
        totalRequestCount={isConsoleMode ? displayedConsoleEntries.length : requests.length}
        searchText={activeSearchText}
        searchMatchIndex={activeSearchMatchIndex}
        searchOccurrenceCount={
          isNetworkMode
            ? searchOccurrences.length
            : isStorageMode
              ? storageSearchOccurrences.length
              : consoleSearchOccurrences.length
        }
        searchInputRef={searchInputRef}
        workspaceMode={workspaceMode}
        networkViewMode={networkViewMode}
        groupFlowByTime={groupFlowByTime}
        networkIncludeText={networkIncludeText}
        networkExcludeText={networkExcludeText}
        storageIncludeText={storageIncludeText}
        storageExcludeText={storageExcludeText}
        consoleIncludeText={consoleIncludeText}
        consoleExcludeText={consoleExcludeText}
        sessionNotice={sessionNotice}
        onSearchTextChange={handleSearchTextChange}
        onSearchNext={() => {
          if (isNetworkMode) goToNetworkSearchMatch(1);
          else if (isStorageMode) goToStorageSearchMatch(1);
          else goToConsoleSearchMatch(1);
        }}
        onSearchPrevious={() => {
          if (isNetworkMode) goToNetworkSearchMatch(-1);
          else if (isStorageMode) goToStorageSearchMatch(-1);
          else goToConsoleSearchMatch(-1);
        }}
        onSearchNextScope={() => {
          if (isNetworkMode) goToNetworkSearchRequest(1);
          else if (isStorageMode) goToStorageSearchItem(1);
          else goToConsoleSearchEntry(1);
        }}
        onSearchPreviousScope={() => {
          if (isNetworkMode) goToNetworkSearchRequest(-1);
          else if (isStorageMode) goToStorageSearchItem(-1);
          else goToConsoleSearchEntry(-1);
        }}
        searchScopeJumpCount={
          isNetworkMode
            ? searchRequestJumpCount
            : isStorageMode
              ? storageSearchRequestJumpCount
              : consoleSearchEntryJumpCount
        }
        activeSearchScopeOrder={
          isNetworkMode
            ? activeSearchRequestOrder
            : isStorageMode
              ? activeStorageItemOrder
              : activeConsoleEntryOrder
        }
        onGroupFlowByTimeChange={setGroupFlowByTime}
        onNetworkIncludeTextChange={setNetworkIncludeText}
        onNetworkExcludeTextChange={setNetworkExcludeText}
        onStorageIncludeTextChange={setStorageIncludeText}
        onStorageExcludeTextChange={setStorageExcludeText}
        onConsoleIncludeTextChange={setConsoleIncludeText}
        onConsoleExcludeTextChange={setConsoleExcludeText}
        onWorkspaceModeChange={setWorkspaceMode}
        onNetworkViewModeChange={setNetworkViewMode}
        onExportSession={handleExportSession}
        onImportSession={() => {
          void handleImportSession();
        }}
        onClear={handleClear}
        searchMatchCase={searchMatchCase}
        searchWholeWord={searchWholeWord}
        onSearchMatchCaseChange={setSearchMatchCase}
        onSearchWholeWordChange={setSearchWholeWord}
      />
      <section
        ref={workspaceRef}
        className={`workspace ${workspaceMode === 'storage' ? 'workspace-storage' : ''} ${workspaceMode === 'console' ? 'workspace-console' : ''} ${isNetworkMode && selectedRequest && isSplitStacked ? 'split-layout-stacked' : ''}`}
        style={
          workspaceMode === 'storage' || workspaceMode === 'console' || !selectedRequest
            ? undefined
            : splitLayoutStyle
        }
      >
        {workspaceMode === 'console' ? (
          <ConsoleView
            entries={consoleEntries}
            selectedEntryId={selectedConsoleEntryId}
            searchText={consoleSearchText}
            includeText={consoleIncludeText}
            excludeText={consoleExcludeText}
            searchMatchIndex={consoleSearchMatchIndex}
            onEntriesChange={setConsoleEntries}
            onSelectedEntryIdChange={setSelectedConsoleEntryId}
            onSearchOccurrencesChange={setConsoleSearchOccurrences}
            onSearchMatchIndexChange={setConsoleSearchMatchIndex}
          />
        ) : workspaceMode === 'storage' ? (
          <StorageView
            searchText={storageSearchText}
            searchMatchIndex={storageSearchMatchIndex}
            includeText={storageIncludeText}
            excludeText={storageExcludeText}
            onSearchOccurrencesChange={setStorageSearchOccurrences}
            onSearchMatchIndexChange={setStorageSearchMatchIndex}
          />
        ) : networkViewMode === 'flow' ? (
          <FlowChartView
            items={timelineItems}
            requests={displayedRequests}
            selectedRequestId={selectedRequestId}
            groupByTime={groupFlowByTime}
            searchText={networkSearchText}
            searchOccurrenceByRequest={searchOccurrenceByRequest}
            activeGlobalSearchIndex={activeGlobalSearchIndex}
            layoutRevision={flowLayoutRevision}
            onSelectRequest={handleSelectRequestWithBodyLoad}
          />
        ) : (
          <TimelineView
            items={timelineItems}
            requests={displayedRequests}
            selectedRequestId={selectedRequestId}
            searchText={networkSearchText}
            searchOccurrenceByRequest={searchOccurrenceByRequest}
            activeGlobalSearchIndex={activeGlobalSearchIndex}
            onSelectRequest={handleSelectRequestWithBodyLoad}
          />
        )}
        {isNetworkMode && selectedRequest ? (
          <>
            <SplitPanelResizer
              orientation={isSplitStacked ? 'horizontal' : 'vertical'}
              ariaLabel="Resize request detail panel"
              onMouseDown={isSplitStacked ? startHeightResize : startWidthResize}
              onDoubleClick={isSplitStacked ? resetSplitHeight : resetSplitWidth}
            />
            <RequestDetailPanel
              request={selectedRequest}
              isBodyLoading={bodyLoadingId === selectedRequest.id}
              searchText={networkSearchText}
              searchOccurrenceIndex={activeSearchOccurrence?.occurrenceIndex ?? 0}
              searchFocusKey={`${networkSearchMatchIndex}:${activeSearchOccurrence?.requestId ?? ''}:${activeSearchOccurrence?.occurrenceIndex ?? 0}`}
              isStacked={isSplitStacked}
              onLoadResponseBody={loadResponseBody}
              onToggleLayout={toggleSplitLayout}
              onClose={() => setSelectedRequestId(null)}
            />
          </>
        ) : null}
      </section>
    </main>
    </SearchOptionsProvider>
  );
}
