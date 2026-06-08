import { formatDateTime, formatDuration, formatLocaleDateTime } from '../components/formatters';
import type { ApiRequest } from '../types/network';
import { getImageSource } from './imageSource';
import { generateCurl, generateFetch } from './requestCodeSnippets';
import { countSearchOccurrences, getSearchTerms, textMatchesSearch } from './searchHighlight';

export type SearchOccurrence = {
  requestId: string;
  occurrenceIndex: number;
};

export type RequestSearchSummary = {
  hitCount: number;
  globalStart: number;
  globalEnd: number;
  requestOrder: number;
};

export { getSearchTerms, textMatchesSearch } from './searchHighlight';

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
  if (!getSearchTerms(query).length) return true;
  return textMatchesSearch(buildRequestSearchText(request), query);
}

function countSearchOccurrencesInValue(value: unknown, searchText: string): number {
  if (!getSearchTerms(searchText).length) return 0;

  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + countSearchOccurrencesInValue(item, searchText), 0);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((sum, [key, item]) => {
      return sum + countSearchOccurrences(key, searchText) + countSearchOccurrencesInValue(item, searchText);
    }, 0);
  }

  if (value === null) return 0;
  if (typeof value === 'string') return countSearchOccurrences(value, searchText);
  if (typeof value === 'number' || typeof value === 'boolean') {
    return countSearchOccurrences(String(value), searchText);
  }

  return countSearchOccurrences(String(value), searchText);
}

function summarizeImageUrl(url: string): string {
  const mimeMatch = url.match(/(?:data:)?(image\/[a-z0-9.+-]+);base64,/i);
  if (!mimeMatch) return url;
  return `${mimeMatch[1]} base64 image data`;
}

function appendPanelOccurrences(
  occurrences: SearchOccurrence[],
  requestId: string,
  markIndex: { value: number },
  searchText: string,
  segments: Array<{ kind: 'text'; text: string } | { kind: 'json'; value: unknown }>,
): void {
  for (const segment of segments) {
    const count =
      segment.kind === 'text'
        ? countSearchOccurrences(segment.text, searchText)
        : countSearchOccurrencesInValue(segment.value, searchText);

    for (let index = 0; index < count; index += 1) {
      occurrences.push({ requestId, occurrenceIndex: markIndex.value });
      markIndex.value += 1;
    }
  }
}

function buildRequestPanelOccurrences(request: ApiRequest, searchText: string): SearchOccurrence[] {
  const occurrences: SearchOccurrence[] = [];
  if (!matchesRequestSearch(request, searchText)) return occurrences;

  const matchingSections = getMatchingDetailSections(request, searchText);
  const titleImageSource =
    getImageSource(request.normalizedPath) ?? getImageSource(request.path) ?? getImageSource(request.url);
  const title = titleImageSource ? 'Image payload' : request.normalizedPath;
  const displayUrl = titleImageSource ? summarizeImageUrl(request.url) : request.url;
  const markIndex = { value: 0 };

  appendPanelOccurrences(occurrences, request.id, markIndex, searchText, [
    { kind: 'text', text: title },
    { kind: 'text', text: request.host },
  ]);

  appendPanelOccurrences(occurrences, request.id, markIndex, searchText, [
    { kind: 'text', text: displayUrl },
    { kind: 'text', text: `${request.status || 'n/a'} ${request.statusText ?? ''}`.trim() },
    { kind: 'text', text: formatDuration(request.duration) },
    { kind: 'text', text: formatDateTime(request.startedAt) },
    { kind: 'text', text: request.type },
    { kind: 'text', text: request.mimeType ?? 'unknown' },
  ]);

  if (matchingSections.has('headers')) {
    appendPanelOccurrences(occurrences, request.id, markIndex, searchText, [
      { kind: 'json', value: request.requestHeaders ?? {} },
      { kind: 'json', value: request.responseHeaders ?? {} },
    ]);
  }

  if (matchingSections.has('payload')) {
    appendPanelOccurrences(occurrences, request.id, markIndex, searchText, [
      { kind: 'json', value: request.queryParams ?? {} },
      { kind: 'json', value: request.requestBody ?? 'Request payload is not available for this request.' },
    ]);
  }

  appendPanelOccurrences(occurrences, request.id, markIndex, searchText, [
    {
      kind: 'json',
      value: request.responsePreview ?? request.responseContent ?? 'Response body is not available.',
    },
  ]);

  if (matchingSections.has('timing')) {
    appendPanelOccurrences(occurrences, request.id, markIndex, searchText, [
      { kind: 'text', text: formatLocaleDateTime(request.startedAt) },
      { kind: 'text', text: formatLocaleDateTime(request.endedAt) },
      { kind: 'text', text: `${request.duration}ms` },
    ]);
  }

  if (matchingSections.has('replay')) {
    appendPanelOccurrences(occurrences, request.id, markIndex, searchText, [
      { kind: 'text', text: generateCurl(request) },
    ]);
  }

  return occurrences;
}

export function buildSearchOccurrences(requests: ApiRequest[], searchText: string): SearchOccurrence[] {
  if (!getSearchTerms(searchText).length) return [];

  return requests.flatMap((request) => buildRequestPanelOccurrences(request, searchText));
}

export function buildSearchOccurrenceSummaryByRequest(
  occurrences: SearchOccurrence[],
): Map<string, RequestSearchSummary> {
  const summaryByRequest = new Map<string, RequestSearchSummary>();
  let globalIndex = 0;
  let requestOrder = 0;
  let lastRequestId: string | null = null;

  for (const occurrence of occurrences) {
    globalIndex += 1;

    if (occurrence.requestId !== lastRequestId) {
      requestOrder += 1;
      lastRequestId = occurrence.requestId;
      summaryByRequest.set(occurrence.requestId, {
        hitCount: 1,
        globalStart: globalIndex,
        globalEnd: globalIndex,
        requestOrder,
      });
      continue;
    }

    const summary = summaryByRequest.get(occurrence.requestId);
    if (!summary) continue;

    summary.hitCount += 1;
    summary.globalEnd = globalIndex;
  }

  return summaryByRequest;
}

export function getRequestJumpIndices(occurrences: SearchOccurrence[]): number[] {
  const indices: number[] = [];
  let lastRequestId: string | null = null;

  occurrences.forEach((occurrence, index) => {
    if (occurrence.requestId === lastRequestId) return;
    indices.push(index);
    lastRequestId = occurrence.requestId;
  });

  return indices;
}

export function getSearchMatchIndexForRequest(
  occurrences: SearchOccurrence[],
  requestId: string,
): number | null {
  const index = occurrences.findIndex((occurrence) => occurrence.requestId === requestId);
  return index >= 0 ? index : null;
}

export function getNextRequestJumpIndex(
  occurrences: SearchOccurrence[],
  currentMatchIndex: number,
  direction: 1 | -1,
): number | null {
  const jumpIndices = getRequestJumpIndices(occurrences);
  if (!jumpIndices.length) return null;

  const currentRequestId = occurrences[currentMatchIndex]?.requestId;
  if (!currentRequestId) return jumpIndices[0] ?? null;

  const currentJumpPos = jumpIndices.findIndex(
    (index) => occurrences[index]?.requestId === currentRequestId,
  );
  const resolvedJumpPos = currentJumpPos >= 0 ? currentJumpPos : 0;
  const nextJumpPos = (resolvedJumpPos + direction + jumpIndices.length) % jumpIndices.length;

  return jumpIndices[nextJumpPos] ?? null;
}

export function getMatchingDetailSections(request: ApiRequest, searchText: string): Set<string> {
  const sections = new Set<string>();
  if (!getSearchTerms(searchText).length) return sections;

  const matches = (text: string) => textMatchesSearch(text, searchText);

  if (
    matches(
      [
        request.url,
        request.method,
        String(request.status),
        request.statusText ?? '',
        request.host,
        request.type,
        request.mimeType ?? '',
      ].join(' '),
    )
  ) {
    sections.add('general');
  }

  if (
    matches(stringifyValue(request.requestHeaders)) ||
    matches(stringifyValue(request.responseHeaders))
  ) {
    sections.add('headers');
  }

  if (matches(stringifyValue(request.queryParams)) || matches(stringifyValue(request.requestBody))) {
    sections.add('payload');
  }

  if (matches(stringifyValue(request.responsePreview)) || matches(stringifyValue(request.responseContent))) {
    sections.add('response');
  }

  if (matches(`${request.startedAt} ${request.endedAt}`)) {
    sections.add('timing');
  }

  if (matches(generateCurl(request)) || matches(generateFetch(request))) {
    sections.add('replay');
  }

  return sections;
}
