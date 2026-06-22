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

export function getStatusTone(status: number): 'neutral' | 'good' | 'warn' | 'bad' {
  if (!status) return 'neutral';
  if (status >= 500) return 'bad';
  if (status >= 400) return 'warn';
  return 'good';
}
