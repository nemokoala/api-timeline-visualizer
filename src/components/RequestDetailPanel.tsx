import { useState } from 'react';
import type { ApiRequest } from '../types/network';
import { getDetailSectionOpen, setDetailSectionOpen } from '../utils/detailSectionPrefs';
import { generateCurl, generateFetch } from '../utils/requestCodeSnippets';
import { getImageSource } from '../utils/imageSource';
import { formatDateTime, formatDuration, formatLocaleDateTime } from './formatters';
import { ImagePreview } from './ImagePreview';
import { JsonViewer } from './JsonViewer';

type RequestDetailPanelProps = {
  request: ApiRequest | null;
  isBodyLoading: boolean;
  onLoadResponseBody: (requestId: string) => void;
};

export function RequestDetailPanel({ request, isBodyLoading, onLoadResponseBody }: RequestDetailPanelProps) {
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
    <aside className="detail-panel">
      <div className="detail-title">
        <div>
          <span className={`method method-${request.method.toLowerCase()}`}>{request.method}</span>
          {titleImageSource ? (
            <div className="detail-image-title">
              <ImagePreview src={titleImageSource} alt="Base64 request preview" />
              <h2>{title}</h2>
            </div>
          ) : (
            <h2>{title}</h2>
          )}
          <p>{request.host}</p>
        </div>
        <span className={`detail-status ${request.status >= 400 ? 'bad' : 'good'}`}>{request.status || 'n/a'}</span>
      </div>

      <DetailSection sectionId="general" title="General" defaultOpen>
        <DefinitionList
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

      <DetailSection sectionId="headers" title="Headers">
        <h3>Request</h3>
        <JsonViewer value={request.requestHeaders ?? {}} />
        <h3>Response</h3>
        <JsonViewer value={request.responseHeaders ?? {}} />
      </DetailSection>

      <DetailSection sectionId="payload" title="Payload">
        <h3>Query Params</h3>
        <JsonViewer value={request.queryParams ?? {}} />
        <h3>Request Body</h3>
        <JsonViewer value={request.requestBody ?? 'Request payload is not available for this request.'} />
      </DetailSection>

      <DetailSection sectionId="response" title="Response" defaultOpen>
        <div className="response-actions">
          <button type="button" onClick={() => onLoadResponseBody(request.id)} disabled={isBodyLoading}>
            {isBodyLoading ? 'Loading...' : request.responseContent === undefined ? 'Load body' : 'Reload body'}
          </button>
        </div>
        <JsonViewer
          value={request.responsePreview ?? request.responseContent ?? 'Response body is not available.'}
          mimeType={request.mimeType}
        />
      </DetailSection>

      <DetailSection sectionId="timing" title="Timing">
        <DefinitionList
          rows={[
            ['Started at', formatLocaleDateTime(request.startedAt)],
            ['Ended at', formatLocaleDateTime(request.endedAt)],
            ['Duration', `${request.duration}ms`],
          ]}
        />
      </DetailSection>

      <DetailSection sectionId="replay" title="Replay">
        <CodeSnippetBlock request={request} />
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
}: {
  sectionId: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(() => getDetailSectionOpen(sectionId, defaultOpen));

  const handleToggle = () => {
    setOpen((current) => {
      const next = !current;
      setDetailSectionOpen(sectionId, next);
      return next;
    });
  };

  return (
    <section className={`detail-section ${open ? 'is-open' : ''}`}>
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

function DefinitionList({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="definition-list">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

type SnippetMode = 'curl' | 'fetch';

function CodeSnippetBlock({ request }: { request: ApiRequest }) {
  const [mode, setMode] = useState<SnippetMode>('curl');
  const [copied, setCopied] = useState(false);
  const snippet = mode === 'curl' ? generateCurl(request) : generateFetch(request);

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
      <pre className="code-snippet-viewer">{snippet}</pre>
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
