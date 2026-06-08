import type { ApiRequest } from '../types/network';

function stringifyValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return String(value);
}

export function buildRequestSearchText(request: ApiRequest): string {
  const queryParams = Object.entries(request.queryParams ?? {}).flatMap(([key, value]) => [key, value]);

  return [
    request.method,
    request.url,
    request.path,
    request.normalizedPath,
    request.host,
    String(request.status),
    request.statusText ?? '',
    request.type,
    request.mimeType ?? '',
    request.error ?? '',
    stringifyValue(request.requestBody),
    stringifyValue(request.responsePreview),
    stringifyValue(request.responseContent),
    ...queryParams,
  ]
    .join(' ')
    .toLowerCase();
}

export function matchesRequestSearch(request: ApiRequest, query: string): boolean {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (!terms.length) return true;

  const haystack = buildRequestSearchText(request);
  return terms.every((term) => haystack.includes(term));
}
