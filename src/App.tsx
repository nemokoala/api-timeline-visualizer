import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlowChartView } from './components/FlowChartView';
import { RequestDetailPanel } from './components/RequestDetailPanel';
import { TimelineView } from './components/TimelineView';
import { Toolbar } from './components/Toolbar';
import type { DevtoolsNetworkRequest } from './types/chrome-har';
import type { ApiRequest } from './types/network';
import {
  matchesTextFilters,
  parseNetworkRequest,
  parseResponseContent,
  shouldCollectRequest,
} from './utils/requestParser';
import { toTimelineItems } from './utils/timeline';

export default function App() {
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [bodyLoadingId, setBodyLoadingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'flow' | 'timeline'>('flow');
  const [includeText, setIncludeText] = useState('api');
  const [excludeText, setExcludeText] = useState('google-analytics,sentry,datadog,amplitude,hotjar,segment');
  const networkRequestById = useRef(new Map<string, chrome.devtools.network.Request>());

  const visibleRequests = useMemo(
    () => requests.filter((request) => matchesTextFilters(request, includeText, excludeText)),
    [excludeText, includeText, requests],
  );
  const selectedRequest = visibleRequests.find((request) => request.id === selectedRequestId) ?? null;
  const timelineItems = useMemo(() => toTimelineItems(visibleRequests), [visibleRequests]);

  useEffect(() => {
    if (!selectedRequestId) return;
    if (visibleRequests.some((request) => request.id === selectedRequestId)) return;
    setSelectedRequestId(null);
  }, [selectedRequestId, visibleRequests]);

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

  return (
    <main className="app-shell">
      <Toolbar
        requestCount={visibleRequests.length}
        totalRequestCount={requests.length}
        viewMode={viewMode}
        includeText={includeText}
        excludeText={excludeText}
        onIncludeTextChange={setIncludeText}
        onExcludeTextChange={setExcludeText}
        onViewModeChange={setViewMode}
        onClear={handleClear}
      />
      <section className="workspace">
        {viewMode === 'flow' ? (
          <FlowChartView
            items={timelineItems}
            requests={visibleRequests}
            selectedRequestId={selectedRequestId}
            onSelectRequest={setSelectedRequestId}
          />
        ) : (
          <TimelineView
            items={timelineItems}
            requests={visibleRequests}
            selectedRequestId={selectedRequestId}
            onSelectRequest={setSelectedRequestId}
          />
        )}
        <RequestDetailPanel
          request={selectedRequest}
          isBodyLoading={bodyLoadingId === selectedRequest?.id}
          onLoadResponseBody={loadResponseBody}
        />
      </section>
    </main>
  );
}
