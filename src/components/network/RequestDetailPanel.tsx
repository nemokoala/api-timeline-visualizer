import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ApiRequest } from '../../types/network';
import { DetailSection } from '../shared/DetailSection';
import { generateCurl, generateFetch } from '../../utils/requestCodeSnippets';
import { getMatchingDetailSections } from '../../utils/requestSearch';
import { scrollSearchHitIntoView } from '../../utils/searchScroll';
import { useSearchOptions } from '../../contexts/SearchOptionsContext';
import { highlightSearchText } from '../../utils/searchHighlight';
import { getImageSource } from '../../utils/imageSource';
import { formatDateTime, formatDuration, formatLocaleDateTime } from '../../utils/formatters';
import { ImagePreview } from '../shared/ImagePreview';
import { DetailPanelCloseButton, SplitLayoutToggleButton } from '../shared/DetailPanelCloseButton';
import { JsonViewer } from '../shared/JsonViewer';
import { Button } from '../ui/Button';

type RequestDetailPanelProps = {
  request: ApiRequest;
  isBodyLoading: boolean;
  searchText: string;
  searchOccurrenceIndex: number;
  searchFocusKey: string;
  isStacked: boolean;
  onLoadResponseBody: (requestId: string) => void;
  onToggleLayout: () => void;
  onClose: () => void;
};

export function RequestDetailPanel({
  request,
  isBodyLoading,
  searchText,
  searchOccurrenceIndex,
  searchFocusKey,
  isStacked,
  onLoadResponseBody,
  onToggleLayout,
  onClose,
}: RequestDetailPanelProps) {
  const searchOptions = useSearchOptions();
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!searchText.trim() || !request) return;

    const frameId = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;

      const marks = panel.querySelectorAll('.search-highlight');
      marks.forEach((mark, index) => {
        mark.classList.toggle('is-active', index === searchOccurrenceIndex);
      });

      const target = marks[searchOccurrenceIndex] ?? marks[0];
      if (!target) return;

      scrollSearchHitIntoView(target);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [request, searchFocusKey, searchOccurrenceIndex, searchText]);

  const hasSearch = Boolean(searchText.trim());
  const matchingSections = useMemo(() => {
    if (!request || !hasSearch) return new Set<string>();
    return getMatchingDetailSections(request, searchText, searchOptions);
    // Body load updates should not re-open collapsed sections.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by selection/search navigation only
  }, [hasSearch, searchText, searchFocusKey, request?.id, searchOptions]);

  const titleImageSource =
    getImageSource(request.normalizedPath) ?? getImageSource(request.path) ?? getImageSource(request.url);
  const title = titleImageSource ? 'Image payload' : request.normalizedPath;
  const displayUrl = titleImageSource ? summarizeImageUrl(request.url) : request.url;
  const responseBodyValue = request.responsePreview ?? request.responseContent;
  const isBodyPending = responseBodyValue === undefined;
  const showLoadingOverlay = isBodyPending || (isBodyLoading && request.responseContent === undefined);

  return (
    <aside className="detail-panel" ref={panelRef}>
      <div className="detail-title">
        <div>
          <span className={`method method-${request.method.toLowerCase()}`}>{request.method}</span>
          {titleImageSource ? (
            <div className="detail-image-title">
              <ImagePreview src={titleImageSource} alt="Base64 request preview" />
              <h2>{hasSearch ? highlightSearchText(title, searchText, searchOptions) : title}</h2>
            </div>
          ) : (
            <h2>{hasSearch ? highlightSearchText(title, searchText, searchOptions) : title}</h2>
          )}
          <p>{hasSearch ? highlightSearchText(request.host, searchText, searchOptions) : request.host}</p>
        </div>
        <div className="detail-panel-title-actions">
          <span className={`detail-status ${request.status >= 400 ? 'bad' : 'good'}`}>{request.status || 'n/a'}</span>
          <SplitLayoutToggleButton isStacked={isStacked} onClick={onToggleLayout} />
          <DetailPanelCloseButton onClick={onClose} label="Close request detail" />
        </div>
      </div>

      <DetailSection
        sectionId="general"
        title="General"
        defaultOpen
        searchExpandToken={searchFocusKey}
        expandForSearch={matchingSections.has('general')}
      >
        <DefinitionList
          searchText={searchText}
          rows={[
            ['Full URL', displayUrl],
            ['Status', `${request.status || 'n/a'} ${request.statusText ?? ''}`.trim()],
            ['Duration', formatDuration(request.duration)],
            ['Started', formatDateTime(request.startedAt)],
            ['Type', request.type],
            ['MIME', request.mimeType ?? 'unknown'],
          ]}
        />
      </DetailSection>

      <DetailSection
        sectionId="headers"
        title="Headers"
        searchExpandToken={searchFocusKey}
        expandForSearch={matchingSections.has('headers')}
      >
        <h3>Request</h3>
        <JsonViewer value={request.requestHeaders ?? {}} searchText={searchText} searchFocusKey={searchFocusKey} />
        <h3>Response</h3>
        <JsonViewer value={request.responseHeaders ?? {}} searchText={searchText} searchFocusKey={searchFocusKey} />
      </DetailSection>

      <DetailSection
        sectionId="payload"
        title="Payload"
        searchExpandToken={searchFocusKey}
        expandForSearch={matchingSections.has('payload')}
      >
        <h3>Query Params</h3>
        <JsonViewer value={request.queryParams ?? {}} searchText={searchText} searchFocusKey={searchFocusKey} />
        <h3>Request Body</h3>
        <JsonViewer
          value={request.requestBody ?? 'Request payload is not available for this request.'}
          searchText={searchText}
          searchFocusKey={searchFocusKey}
        />
      </DetailSection>

      <DetailSection
        sectionId="response"
        title="Response"
        defaultOpen
        searchExpandToken={searchFocusKey}
        expandForSearch={matchingSections.has('response')}
      >
        <div className="response-actions">
          <Button
            onClick={() => onLoadResponseBody(request.id)}
            disabled={isBodyLoading || isBodyPending}
          >
            {isBodyLoading || isBodyPending
              ? 'Loading...'
              : request.responseContent === undefined
                ? 'Load body'
                : 'Reload body'}
          </Button>
        </div>
        <div className={`response-json-slot ${showLoadingOverlay ? 'is-loading' : ''}`}>
          <div
            className="response-loading-overlay"
            aria-live="polite"
            aria-hidden={!showLoadingOverlay}
          >
            Loading response body...
          </div>
          {responseBodyValue !== undefined ? (
            <JsonViewer
              instanceId={request.id}
              value={responseBodyValue}
              mimeType={request.mimeType}
              searchText={searchText}
              searchFocusKey={searchFocusKey}
            />
          ) : (
            <ResponseBodySkeleton />
          )}
        </div>
      </DetailSection>

      <DetailSection
        sectionId="timing"
        title="Timing"
        searchExpandToken={searchFocusKey}
        expandForSearch={matchingSections.has('timing')}
      >
        <DefinitionList
          searchText={searchText}
          rows={[
            ['Started at', formatLocaleDateTime(request.startedAt)],
            ['Ended at', formatLocaleDateTime(request.endedAt)],
            ['Duration', `${request.duration}ms`],
          ]}
        />
      </DetailSection>

      <DetailSection
        sectionId="replay"
        title="Replay"
        searchExpandToken={searchFocusKey}
        expandForSearch={matchingSections.has('replay')}
      >
        <CodeSnippetBlock request={request} searchText={searchText} />
      </DetailSection>
    </aside>
  );
}

function ResponseBodySkeleton() {
  return (
    <div className="json-viewer-wrap response-json-skeleton" aria-hidden="true">
      <div className="json-viewer-toolbar" />
      <div className="json-viewer-body">
        <pre className="json-viewer" />
      </div>
    </div>
  );
}

function summarizeImageUrl(url: string): string {
  const mimeMatch = url.match(/(?:data:)?(image\/[a-z0-9.+-]+);base64,/i);
  if (!mimeMatch) return url;
  return `${mimeMatch[1]} base64 image data`;
}

function DefinitionList({
  rows,
  searchText,
}: {
  rows: Array<[string, string]>;
  searchText: string;
}) {
  const searchOptions = useSearchOptions();
  const hasSearch = Boolean(searchText.trim());

  return (
    <dl className="definition-list">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{hasSearch ? highlightSearchText(value, searchText, searchOptions) : value}</dd>
        </div>
      ))}
    </dl>
  );
}

type SnippetMode = 'curl' | 'fetch';

function CodeSnippetBlock({ request, searchText }: { request: ApiRequest; searchText: string }) {
  const searchOptions = useSearchOptions();
  const [mode, setMode] = useState<SnippetMode>('curl');
  const [copied, setCopied] = useState(false);
  const snippet = mode === 'curl' ? generateCurl(request) : generateFetch(request);
  const hasSearch = Boolean(searchText.trim());

  const handleCopy = async () => {
    const didCopy = await copyToClipboard(snippet);
    if (!didCopy) return;

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="code-snippet-block">
      <div className="code-snippet-actions">
        <div className="segmented-control" aria-label="Replay snippet type">
          <button className={mode === 'curl' ? 'active' : ''} type="button" onClick={() => setMode('curl')}>
            cURL
          </button>
          <button className={mode === 'fetch' ? 'active' : ''} type="button" onClick={() => setMode('fetch')}>
            fetch
          </button>
        </div>
        <Button onClick={() => void handleCopy()}>{copied ? 'Copied' : 'Copy'}</Button>
      </div>
      <pre className="code-snippet-viewer">
        {hasSearch ? highlightSearchText(snippet, searchText, searchOptions) : snippet}
      </pre>
    </div>
  );
}

async function copyToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const result = document.execCommand('copy');
    document.body.removeChild(textarea);
    return result;
  } catch {
    return false;
  }
}
