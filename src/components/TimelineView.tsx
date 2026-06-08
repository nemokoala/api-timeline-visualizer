import type { ApiRequest, TimelineItem } from '../types/network';
import { formatDuration, formatOffset, getStatusTone } from './formatters';

type TimelineViewProps = {
  items: TimelineItem[];
  requests: ApiRequest[];
  selectedRequestId: string | null;
  onSelectRequest: (requestId: string) => void;
};

export function TimelineView({ items, requests, selectedRequestId, onSelectRequest }: TimelineViewProps) {
  const maxEnd = Math.max(100, ...items.map((item) => item.startOffset + item.duration));
  const requestById = new Map(requests.map((request) => [request.id, request]));

  return (
    <section className="timeline-panel" aria-label="Timeline">
      <div className="timeline-heading">
        <span>Time</span>
        <span>Request</span>
        <span>Status</span>
        <span>Duration</span>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <strong>No API requests captured.</strong>
          <span>Open a page with DevTools active and trigger XHR or fetch traffic.</span>
        </div>
      ) : (
        <div className="timeline-list">
          {items.map((item) => {
            const request = requestById.get(item.requestId);
            const startPercent = Math.min(94, (item.startOffset / maxEnd) * 100);
            const widthPercent = Math.max(2, (item.duration / maxEnd) * 100);

            return (
              <button
                key={item.id}
                className={`request-row ${selectedRequestId === item.requestId ? 'selected' : ''}`}
                type="button"
                onClick={() => onSelectRequest(item.requestId)}
              >
                <span className="offset">{formatOffset(item.startOffset)}</span>
                <span className="request-main">
                  <span className="request-meta">
                    <span className={`method method-${item.method.toLowerCase()}`}>{item.method}</span>
                    <span className="path">{item.normalizedPath}</span>
                  </span>
                  <span className="bar-track" aria-hidden="true">
                    <span
                      className={`bar ${item.isError ? 'error' : item.isSlow ? 'slow' : 'ok'}`}
                      style={{ left: `${startPercent}%`, width: `${widthPercent}%` }}
                    />
                  </span>
                </span>
                <span className={`status ${getStatusTone(item.status)}`}>{item.status || 'n/a'}</span>
                <span className="duration">{formatDuration(request?.duration ?? item.duration)}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
