import type { RequestKind } from '../types/network';

export function formatDuration(duration: number): string {
  if (duration < 1000) return `${Math.round(duration)}ms`;
  return `${(duration / 1000).toFixed(2)}s`;
}

export function formatOffset(offset: number): string {
  return `+${Math.round(offset)}ms`;
}

/** 바이트 크기를 사람이 읽기 쉬운 단위로. 값이 없으면 '—'. */
export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

/* 종류별 라벨 색. API 계열은 blue/purple, 정적 리소스는 각기 다른 색으로 구분. */
export const REQUEST_KIND_TEXT_COLOR: Record<RequestKind, string> = {
  fetch: 'text-accent',
  document: 'text-accent',
  xhr: 'text-purple',
  websocket: 'text-purple',
  stylesheet: 'text-teal',
  script: 'text-warn',
  image: 'text-ok',
  font: 'text-pink',
  media: 'text-danger',
  other: 'text-ink-weak',
};

export function getStatusTone(status: number): 'neutral' | 'good' | 'warn' | 'bad' {
  if (!status) return 'neutral';
  if (status >= 500) return 'bad';
  if (status >= 400) return 'warn';
  return 'good';
}
