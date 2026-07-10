import type { ApiRequest, TimelineItem } from '../types/network';

export const SLOW_THRESHOLD_MS = 1000;

export function toTimelineItems(requests: ApiRequest[]): TimelineItem[] {
  if (!requests.length) return [];

  const firstStart = Math.min(...requests.map((request) => request.startedAt));

  return [...requests]
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((request) => ({
      id: `timeline-${request.id}`,
      requestId: request.id,
      label: `${request.method} ${request.normalizedPath}`,
      startOffset: request.startedAt - firstStart,
      duration: request.duration,
      status: request.status,
      method: request.method,
      host: request.host,
      path: request.path,
      normalizedPath: request.normalizedPath,
      size: request.size,
      timings: request.timings,
      isSlow: request.duration >= SLOW_THRESHOLD_MS,
      isError: request.status >= 400 || Boolean(request.error),
    }));
}
