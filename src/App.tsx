import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlowChartView } from './components/FlowChartView';
import { RequestDetailPanel } from './components/RequestDetailPanel';
import { TimelineView } from './components/TimelineView';
import { Toolbar } from './components/Toolbar';
import type { DevtoolsNetworkRequest } from './types/chrome-har';
import type { ApiRequest } from './types/network';
import { exportSession, parseSession, pickSessionFile } from './utils/sessionIO';
import {
  matchesTextFilters,
  parseNetworkRequest,
  parseResponseContent,
  shouldCollectRequest,
} from './utils/requestParser';
import { matchesRequestSearch } from './utils/requestSearch';
import { toTimelineItems } from './utils/timeline';

export default function App() {
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [bodyLoadingId, setBodyLoadingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'flow' | 'timeline'>('flow');
  const [groupFlowByTime, setGroupFlowByTime] = useState(true);
  const [includeText, setIncludeText] = useState('api');
  const [excludeText, setExcludeText] = useState('google-analytics,sentry,datadog,amplitude,hotjar,segment');
  const [searchText, setSearchText] = useState('');
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [detailPanelWidth, setDetailPanelWidth] = useState(460);
  const [isResizingDetail, setIsResizingDetail] = useState(false);
  const networkRequestById = useRef(new Map<string, chrome.devtools.network.Request>());
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredRequests = useMemo(
    () => requests.filter((request) => matchesTextFilters(request, includeText, excludeText)),
    [excludeText, includeText, requests],
  );

  const searchMatches = useMemo(() => {
    if (!searchText.trim()) return filteredRequests;
    return filteredRequests.filter((request) => matchesRequestSearch(request, searchText));
  }, [filteredRequests, searchText]);

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
    if (!searchText.trim() || !searchMatches.length) return;

    const clampedIndex = searchMatchIndex % searchMatches.length;
    if (clampedIndex !== searchMatchIndex) {
      setSearchMatchIndex(clampedIndex);
      return;
    }

    const activeMatch = searchMatches[clampedIndex];
    if (activeMatch) setSelectedRequestId(activeMatch.id);
  }, [searchMatchIndex, searchMatches, searchText]);

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
      if (!searchMatches.length) return;
      setSearchMatchIndex((current) => {
        const nextIndex = (current + direction + searchMatches.length) % searchMatches.length;
        return nextIndex;
      });
    },
    [searchMatches],
  );

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

  const loadResponseBody = useCallback((requestId: string) => {
    const networkRequest = networkRequestById.current.get(requestId);
    if (!networkRequest) {
      setRequests((current) =>
        current.map((request) =>
          request.id === requestId ? { ...request, responseContent: 'Response body is not available.' } : request,
        ),
      );
      return;
    }

    setBodyLoadingId(requestId);

    networkRequest.getContent((content) => {
      setRequests((current) =>
        current.map((request) =>
          request.id === requestId
            ? {
                ...request,
                responseContent: content || 'Response body is not available.',
                responsePreview: parseResponseContent(content, request.mimeType),
              }
            : request,
        ),
      );
      setBodyLoadingId(null);
    });
  }, []);

  useEffect(() => {
    if (!selectedRequest) return;
    if (bodyLoadingId === selectedRequest.id) return;
    if (selectedRequest.responseContent !== undefined) return;

    loadResponseBody(selectedRequest.id);
  }, [bodyLoadingId, loadResponseBody, selectedRequest]);

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
        searchMatchCount={searchMatches.length}
        searchInputRef={searchInputRef}
        viewMode={viewMode}
        groupFlowByTime={groupFlowByTime}
        includeText={includeText}
        excludeText={excludeText}
        sessionNotice={sessionNotice}
        onSearchTextChange={handleSearchTextChange}
        onSearchNext={() => goToSearchMatch(1)}
        onSearchPrevious={() => goToSearchMatch(-1)}
        onGroupFlowByTimeChange={setGroupFlowByTime}
        onIncludeTextChange={setIncludeText}
        onExcludeTextChange={setExcludeText}
        onViewModeChange={setViewMode}
        onExportSession={handleExportSession}
        onImportSession={() => {
          void handleImportSession();
        }}
        onClear={handleClear}
      />
      <section
        className="workspace"
        style={{ gridTemplateColumns: `minmax(0, 1fr) 8px minmax(320px, ${detailPanelWidth}px)` }}
      >
        {viewMode === 'flow' ? (
          <FlowChartView
            items={timelineItems}
            requests={displayedRequests}
            selectedRequestId={selectedRequestId}
            groupByTime={groupFlowByTime}
            searchText={searchText}
            onSelectRequest={setSelectedRequestId}
          />
        ) : (
          <TimelineView
            items={timelineItems}
            requests={displayedRequests}
            selectedRequestId={selectedRequestId}
            searchText={searchText}
            onSelectRequest={setSelectedRequestId}
          />
        )}
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
          onLoadResponseBody={loadResponseBody}
        />
      </section>
    </main>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
