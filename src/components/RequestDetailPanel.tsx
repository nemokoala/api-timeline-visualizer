import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ApiRequest } from '../types/network';
import { getDetailSectionOpen, setDetailSectionOpen } from '../utils/detailSectionPrefs';
import { generateCurl, generateFetch } from '../utils/requestCodeSnippets';
import { getMatchingDetailSections } from '../utils/requestSearch';
import { highlightSearchText } from '../utils/searchHighlight';
import { getImageSource } from '../utils/imageSource';
import { formatDateTime, formatDuration, formatLocaleDateTime } from './formatters';
import { ImagePreview } from './ImagePreview';
import { JsonViewer } from './JsonViewer';

type RequestDetailPanelProps = {
  request: ApiRequest | null;
  isBodyLoading: boolean;
  searchText: string;
  searchOccurrenceIndex: number;
  searchFocusKey: string;
  onLoadResponseBody: (requestId: string) => void;
};

export function RequestDetailPanel({
  request,
  isBodyLoading,
  searchText,
  searchOccurrenceIndex,
  searchFocusKey,
  onLoadResponseBody,
}: RequestDetailPanelProps) {
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

      target.scrollIntoView({ block: 'center', behavior: 'smooth' });

      const jsonViewer = target.closest('.json-viewer');
      if (jsonViewer instanceof HTMLElement) {
        jsonViewer.scrollTop = Math.max(
          0,
          target instanceof HTMLElement
            ? target.offsetTop - jsonViewer.clientHeight / 2
            : 0,
        );
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [request, searchFocusKey, searchOccurrenceIndex, searchText]);

  const hasSearch = Boolean(searchText.trim());
  const matchingSections = useMemo(() => {
    if (!request || !hasSearch) return new Set<string>();
    return getMatchingDetailSections(request, searchText);
    // Body load updates should not re-open collapsed sections.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by selection/search navigation only
  }, [hasSearch, searchText, searchFocusKey, request?.id]);

  if (!request) {
    return (
      <aside className="detail-panel">
        <div className="detail-empty">
          <strong>Select a request</strong>
          <span>Headers, payload, response, and timing details appear here.</span>
        </div>
      </aside>
    );
  }

  const titleImageSource =
    getImageSource(request.normalizedPath) ?? getImageSource(request.path) ?? getImageSource(request.url);
  const title = titleImageSource ? 'Image payload' : request.normalizedPath;
  const displayUrl = titleImageSource ? summarizeImageUrl(request.url) : request.url;

  return (
    <aside className="detail-panel" ref={panelRef}>
      <div className="detail-title">
        <div>
          <span className={`method method-${request.method.toLowerCase()}`}>{request.method}</span>
          {titleImageSource ? (
            <div className="detail-image-title">
              <ImagePreview src={titleImageSource} alt="Base64 request preview" />
              <h2>{hasSearch ? highlightSearchText(title, searchText) : title}</h2>
            </div>
          ) : (
            <h2>{hasSearch ? highlightSearchText(title, searchText) : title}</h2>
          )}
          <p>{hasSearch ? highlightSearchText(request.host, searchText) : request.host}</p>
        </div>
        <span className={`detail-status ${request.status >= 400 ? 'bad' : 'good'}`}>{request.status || 'n/a'}</span>
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
        <JsonViewer value={request.requestHeaders ?? {}} searchText={searchText} />
        <h3>Response</h3>
        <JsonViewer value={request.responseHeaders ?? {}} searchText={searchText} />
      </DetailSection>

      <DetailSection
        sectionId="payload"
        title="Payload"
        searchExpandToken={searchFocusKey}
        expandForSearch={matchingSections.has('payload')}
      >
        <h3>Query Params</h3>
        <JsonViewer value={request.queryParams ?? {}} searchText={searchText} />
        <h3>Request Body</h3>
        <JsonViewer value={request.requestBody ?? 'Request payload is not available for this request.'} searchText={searchText} />
      </DetailSection>

      <DetailSection
        sectionId="response"
        title="Response"
        defaultOpen
        searchExpandToken={searchFocusKey}
        expandForSearch={matchingSections.has('response')}
      >
        <div className="response-actions">
          <button type="button" onClick={() => onLoadResponseBody(request.id)} disabled={isBodyLoading}>
            {isBodyLoading ? 'Loading...' : request.responseContent === undefined ? 'Load body' : 'Reload body'}
          </button>
        </div>
        <div
          className={`response-json-slot ${isBodyLoading && request.responseContent === undefined ? 'is-loading' : ''}`}
        >
          {isBodyLoading && request.responseContent === undefined ? (
            <div className="response-loading-overlay" aria-live="polite">
              Loading response body...
            </div>
          ) : null}
          <JsonViewer
            value={request.responsePreview ?? request.responseContent ?? 'Response body is not available.'}
            mimeType={request.mimeType}
            searchText={searchText}
          />
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

function summarizeImageUrl(url: string): string {
  const mimeMatch = url.match(/(?:data:)?(image\/[a-z0-9.+-]+);base64,/i);
  if (!mimeMatch) return url;
  return `${mimeMatch[1]} base64 image data`;
}

function DetailSection({
  sectionId,
  title,
  children,
  defaultOpen = false,
  expandForSearch = false,
  searchExpandToken = '',
}: {
  sectionId: string;
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  expandForSearch?: boolean;
  searchExpandToken?: string;
}) {
  const [open, setOpen] = useState(() => getDetailSectionOpen(sectionId, defaultOpen));

  useEffect(() => {
    if (!expandForSearch) return;
    setOpen(true);
    setDetailSectionOpen(sectionId, true);
  }, [searchExpandToken, sectionId]);

  const handleToggle = () => {
    setOpen((current) => {
      const next = !current;
      setDetailSectionOpen(sectionId, next);
      return next;
    });
  };

  return (
    <section className={`detail-section ${open ? 'is-open' : ''} ${expandForSearch ? 'has-search-match' : ''}`}>
      <button
        className="detail-section-toggle"
        type="button"
        aria-expanded={open}
        onClick={handleToggle}
      >
        <span className="detail-section-title">{title}</span>
        <span className="detail-section-chevron" aria-hidden="true" />
      </button>
      {open ? <div className="detail-section-body">{children}</div> : null}
    </section>
  );
}

function DefinitionList({
  rows,
  searchText,
}: {
  rows: Array<[string, string]>;
  searchText: string;
}) {
  const hasSearch = Boolean(searchText.trim());

  return (
    <dl className="definition-list">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{hasSearch ? highlightSearchText(value, searchText) : value}</dd>
        </div>
      ))}
    </dl>
  );
}

type SnippetMode = 'curl' | 'fetch';

function CodeSnippetBlock({ request, searchText }: { request: ApiRequest; searchText: string }) {
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
        <button className="toolbar-button" type="button" onClick={() => void handleCopy()}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="code-snippet-viewer">
        {hasSearch ? highlightSearchText(snippet, searchText) : snippet}
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
