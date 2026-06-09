import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlowChartView } from './components/FlowChartView';
import { RequestDetailPanel } from './components/RequestDetailPanel';
import { StorageView } from './components/StorageView';
import { TimelineView } from './components/TimelineView';
import { Toolbar, type NetworkViewMode, type WorkspaceMode } from './components/Toolbar';
import type { DevtoolsNetworkRequest } from './types/chrome-har';
import type { ApiRequest } from './types/network';
import { exportSession, parseSession, pickSessionFile } from './utils/sessionIO';
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
  matchesRequestSearch,
} from './utils/requestSearch';
import {
  getExcludeText,
  getIncludeText,
  saveExcludeText,
  saveIncludeText,
} from './utils/filterPrefs';
import { toTimelineItems } from './utils/timeline';

const PRELOAD_CONCURRENCY = 4;
const PRELOAD_MAX = 100;

export default function App() {
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [bodyLoadingId, setBodyLoadingId] = useState<string | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('network');
  const [networkViewMode, setNetworkViewMode] = useState<NetworkViewMode>('flow');
  const [groupFlowByTime, setGroupFlowByTime] = useState(true);
  const [includeText, setIncludeText] = useState(() => getIncludeText());
  const [excludeText, setExcludeText] = useState(() => getExcludeText());
  const [searchText, setSearchText] = useState('');
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [detailPanelWidth, setDetailPanelWidth] = useState(460);
  const [isResizingDetail, setIsResizingDetail] = useState(false);
  const networkRequestById = useRef(new Map<string, chrome.devtools.network.Request>());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const preloadQueueRef = useRef<string[]>([]);
  const preloadInFlightRef = useRef(new Set<string>());

  useEffect(() => {
    saveIncludeText(includeText);
  }, [includeText]);

  useEffect(() => {
    saveExcludeText(excludeText);
  }, [excludeText]);

  const filteredRequests = useMemo(
    () => requests.filter((request) => matchesTextFilters(request, includeText, excludeText)),
    [excludeText, includeText, requests],
  );

  const searchMatches = useMemo(() => {
    if (!searchText.trim()) return filteredRequests;
    return filteredRequests.filter((request) => matchesRequestSearch(request, searchText));
  }, [filteredRequests, searchText]);

  const searchOccurrences = useMemo(() => {
    if (!searchText.trim()) return [];
    return buildSearchOccurrences(searchMatches, searchText);
  }, [searchMatches, searchText]);

  const activeSearchOccurrence = searchOccurrences[searchMatchIndex] ?? null;
  const searchOccurrenceByRequest = useMemo(
    () => buildSearchOccurrenceSummaryByRequest(searchOccurrences),
    [searchOccurrences],
  );
  const activeGlobalSearchIndex =
    searchText.trim() && searchOccurrences.length > 0 ? searchMatchIndex + 1 : null;
  const searchRequestJumpCount = searchOccurrenceByRequest.size;
  const activeSearchRequestOrder = activeSearchOccurrence
    ? (searchOccurrenceByRequest.get(activeSearchOccurrence.requestId)?.requestOrder ?? 0)
    : 0;
  const displayedRequests = searchMatches;
  const selectedRequest = displayedRequests.find((request) => request.id === selectedRequestId) ?? null;
  const timelineItems = useMemo(() => toTimelineItems(displayedRequests), [displayedRequests]);

  useEffect(() => {
    if (!selectedRequestId) return;
    if (displayedRequests.some((request) => request.id === selectedRequestId)) return;
    setSelectedRequestId(null);
  }, [displayedRequests, selectedRequestId]);

  useEffect(() => {
    setSearchMatchIndex(0);
  }, [searchText]);

  useEffect(() => {
    if (!searchText.trim() || !searchOccurrences.length) return;

    const clampedIndex = searchMatchIndex % searchOccurrences.length;
    if (clampedIndex !== searchMatchIndex) {
      setSearchMatchIndex(clampedIndex);
      return;
    }

    const activeOccurrence = searchOccurrences[clampedIndex];
    if (activeOccurrence) setSelectedRequestId(activeOccurrence.requestId);
  }, [searchMatchIndex, searchOccurrences, searchText]);

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
    setSearchText('');
    setSearchMatchIndex(0);
  }, []);

  const handleSearchTextChange = useCallback((value: string) => {
    setSearchText(value);
  }, []);

  const goToSearchMatch = useCallback(
    (direction: 1 | -1) => {
      if (!searchOccurrences.length) return;
      setSearchMatchIndex((current) => {
        const nextIndex = (current + direction + searchOccurrences.length) % searchOccurrences.length;
        return nextIndex;
      });
    },
    [searchOccurrences],
  );

  const goToSearchRequest = useCallback(
    (direction: 1 | -1) => {
      if (!searchOccurrences.length) return;
      setSearchMatchIndex((current) => {
        const nextIndex = getNextRequestJumpIndex(searchOccurrences, current, direction);
        return nextIndex ?? current;
      });
    },
    [searchOccurrences],
  );

  const handleSelectRequest = useCallback(
    (requestId: string) => {
      if (searchText.trim()) {
        const matchIndex = getSearchMatchIndexForRequest(searchOccurrences, requestId);
        if (matchIndex !== null) {
          setSearchMatchIndex(matchIndex);
        }
      }

      setSelectedRequestId(requestId);
    },
    [searchOccurrences, searchText],
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
    exportSession(requests);
    setSessionNotice(`Exported ${requests.length} requests.`);
  }, [requests]);

  const handleImportSession = useCallback(async () => {
    try {
      const content = await pickSessionFile();
      const importedRequests = parseSession(content);
      networkRequestById.current.clear();
      setRequests(importedRequests);
      setSelectedRequestId(importedRequests[0]?.id ?? null);
      setSearchText('');
      setSearchMatchIndex(0);
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
    if (!searchText.trim()) {
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
  }, [drainPreloadQueue, filteredRequests, searchText]);

  useEffect(() => {
    if (!selectedRequest) return;
    startResponseBodyLoad(selectedRequest.id);
  }, [selectedRequest, startResponseBodyLoad]);

  useEffect(() => {
    if (!isResizingDetail) return;

    const handleMouseMove = (event: MouseEvent) => {
      const nextWidth = window.innerWidth - event.clientX;
      setDetailPanelWidth(clamp(nextWidth, 320, Math.min(820, window.innerWidth * 0.72)));
    };

    const handleMouseUp = () => {
      setIsResizingDetail(false);
    };

    document.body.classList.add('resizing-detail-panel');
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.classList.remove('resizing-detail-panel');
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingDetail]);

  return (
    <main className="app-shell">
      <Toolbar
        requestCount={displayedRequests.length}
        totalRequestCount={requests.length}
        searchText={searchText}
        searchMatchIndex={searchMatchIndex}
        searchOccurrenceCount={searchOccurrences.length}
        searchRequestCount={searchMatches.length}
        searchInputRef={searchInputRef}
        workspaceMode={workspaceMode}
        networkViewMode={networkViewMode}
        groupFlowByTime={groupFlowByTime}
        includeText={includeText}
        excludeText={excludeText}
        sessionNotice={sessionNotice}
        onSearchTextChange={handleSearchTextChange}
        onSearchNext={() => goToSearchMatch(1)}
        onSearchPrevious={() => goToSearchMatch(-1)}
        onSearchNextRequest={() => goToSearchRequest(1)}
        onSearchPreviousRequest={() => goToSearchRequest(-1)}
        searchRequestJumpCount={searchRequestJumpCount}
        activeSearchRequestOrder={activeSearchRequestOrder}
        onGroupFlowByTimeChange={setGroupFlowByTime}
        onIncludeTextChange={setIncludeText}
        onExcludeTextChange={setExcludeText}
        onWorkspaceModeChange={setWorkspaceMode}
        onNetworkViewModeChange={setNetworkViewMode}
        onExportSession={handleExportSession}
        onImportSession={() => {
          void handleImportSession();
        }}
        onClear={handleClear}
      />
      <section
        className={`workspace ${workspaceMode === 'storage' ? 'workspace-storage' : ''}`}
        style={{
          gridTemplateColumns:
            workspaceMode === 'storage' ? 'minmax(0, 1fr)' : `minmax(0, 1fr) 8px minmax(320px, ${detailPanelWidth}px)`,
        }}
      >
        {workspaceMode === 'storage' ? (
          <StorageView searchText={searchText} excludeText={excludeText} />
        ) : networkViewMode === 'flow' ? (
          <FlowChartView
            items={timelineItems}
            requests={displayedRequests}
            selectedRequestId={selectedRequestId}
            groupByTime={groupFlowByTime}
            searchText={searchText}
            searchOccurrenceByRequest={searchOccurrenceByRequest}
            activeGlobalSearchIndex={activeGlobalSearchIndex}
            onSelectRequest={handleSelectRequestWithBodyLoad}
          />
        ) : (
          <TimelineView
            items={timelineItems}
            requests={displayedRequests}
            selectedRequestId={selectedRequestId}
            searchText={searchText}
            searchOccurrenceByRequest={searchOccurrenceByRequest}
            activeGlobalSearchIndex={activeGlobalSearchIndex}
            onSelectRequest={handleSelectRequestWithBodyLoad}
          />
        )}
        {workspaceMode === 'storage' ? null : (
          <>
            <button
              className="detail-resizer"
              type="button"
              aria-label="Resize request detail panel"
              onMouseDown={(event) => {
                event.preventDefault();
                setIsResizingDetail(true);
              }}
              onDoubleClick={() => setDetailPanelWidth(460)}
            />
            <RequestDetailPanel
              request={selectedRequest}
              isBodyLoading={bodyLoadingId === selectedRequest?.id}
              searchText={searchText}
              searchOccurrenceIndex={activeSearchOccurrence?.occurrenceIndex ?? 0}
              searchFocusKey={`${searchMatchIndex}:${activeSearchOccurrence?.requestId ?? ''}:${activeSearchOccurrence?.occurrenceIndex ?? 0}`}
              onLoadResponseBody={loadResponseBody}
            />
          </>
        )}
      </section>
    </main>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
