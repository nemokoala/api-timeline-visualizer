import type { RequestKind } from '../types/network';

export function formatDuration(duration: number): string {
  if (duration < 1000) return `${Math.round(duration)}ms`;
  return `${(duration / 1000).toFixed(2)}s`;
}

export function formatOffset(offset: number): string {
  return `+${Math.round(offset)}ms`;
}

export function formatDateTime(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return 'unknown';
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: false,
  }).format(timestamp);
}

export function formatLocaleDateTime(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return 'unknown';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: false,
  }).format(timestamp);
}

const REQUEST_KIND_LABELS: Record<RequestKind, string> = {
  fetch: 'Fetch',
  xhr: 'XHR',
  document: 'Doc',
  websocket: 'WS',
  stylesheet: 'CSS',
  script: 'JS',
  image: 'Img',
  font: 'Font',
  media: 'Media',
  other: 'Other',
};

/** 요청 종류(fetch/xhr/css/js/…)를 행에 표시할 짧은 라벨로 변환한다. */
export function getRequestKindLabel(kind: RequestKind): string {
  return REQUEST_KIND_LABELS[kind] ?? 'Other';
}

export function getStatusTone(status: number): 'neutral' | 'good' | 'warn' | 'bad' {
  if (!status) return 'neutral';
  if (status >= 500) return 'bad';
  if (status >= 400) return 'warn';
  return 'good';
}
