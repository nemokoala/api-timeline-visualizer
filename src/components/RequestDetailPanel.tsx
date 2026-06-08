import type { ApiRequest } from '../types/network';
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

      <DetailSection title="General">
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

      <DetailSection title="Headers">
        <h3>Request</h3>
        <JsonViewer value={request.requestHeaders ?? {}} />
        <h3>Response</h3>
        <JsonViewer value={request.responseHeaders ?? {}} />
      </DetailSection>

      <DetailSection title="Payload">
        <h3>Query Params</h3>
        <JsonViewer value={request.queryParams ?? {}} />
        <h3>Request Body</h3>
        <JsonViewer value={request.requestBody ?? 'Request payload is not available for this request.'} />
      </DetailSection>

      <DetailSection title="Response">
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

      <DetailSection title="Timing">
        <DefinitionList
          rows={[
            ['Started at', formatLocaleDateTime(request.startedAt)],
            ['Ended at', formatLocaleDateTime(request.endedAt)],
            ['Duration', `${request.duration}ms`],
          ]}
        />
      </DetailSection>
    </aside>
  );
}

function summarizeImageUrl(url: string): string {
  const mimeMatch = url.match(/(?:data:)?(image\/[a-z0-9.+-]+);base64,/i);
  if (!mimeMatch) return url;
  return `${mimeMatch[1]} base64 image data`;
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="detail-section">
      <h2>{title}</h2>
      {children}
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
