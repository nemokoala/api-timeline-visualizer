import { formatDateTime, formatDuration, formatLocaleDateTime } from '../components/formatters';
import type { ApiRequest } from '../types/network';
import { getImageSource } from './imageSource';
import { generateCurl, generateFetch } from './requestCodeSnippets';
import {
  countSearchOccurrences,
  getSearchTerms,
  textMatchesSearch,
  type SearchOptions,
} from './searchHighlight';

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

export function buildRequestSearchText(request: ApiRequest, options?: SearchOptions): string {
  const queryParams = Object.entries(request.queryParams ?? {}).flatMap(([key, value]) => [key, value]);

  const text = [
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
  ].join(' ');

  return options?.matchCase ? text : text.toLowerCase();
}

export function matchesRequestSearch(
  request: ApiRequest,
  query: string,
  options?: SearchOptions,
): boolean {
  if (!getSearchTerms(query, options).length) return true;
  return textMatchesSearch(buildRequestSearchText(request, options), query, options);
}

function countSearchOccurrencesInValue(
  value: unknown,
  searchText: string,
  options?: SearchOptions,
): number {
  if (!getSearchTerms(searchText, options).length) return 0;

  if (Array.isArray(value)) {
    return value.reduce(
      (sum, item) => sum + countSearchOccurrencesInValue(item, searchText, options),
      0,
    );
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((sum, [key, item]) => {
      return (
        sum +
        countSearchOccurrences(key, searchText, options) +
        countSearchOccurrencesInValue(item, searchText, options)
      );
    }, 0);
  }

  if (value === null) return 0;
  if (typeof value === 'string') return countSearchOccurrences(value, searchText, options);
  if (typeof value === 'number' || typeof value === 'boolean') {
    return countSearchOccurrences(String(value), searchText, options);
  }

  return countSearchOccurrences(String(value), searchText, options);
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
  options?: SearchOptions,
): void {
  for (const segment of segments) {
    const count =
      segment.kind === 'text'
        ? countSearchOccurrences(segment.text, searchText, options)
        : countSearchOccurrencesInValue(segment.value, searchText, options);

    for (let index = 0; index < count; index += 1) {
      occurrences.push({ requestId, occurrenceIndex: markIndex.value });
      markIndex.value += 1;
    }
  }
}

function buildRequestPanelOccurrences(
  request: ApiRequest,
  searchText: string,
  options?: SearchOptions,
): SearchOccurrence[] {
  const occurrences: SearchOccurrence[] = [];
  if (!matchesRequestSearch(request, searchText, options)) return occurrences;

  const matchingSections = getMatchingDetailSections(request, searchText, options);
  const titleImageSource =
    getImageSource(request.normalizedPath) ?? getImageSource(request.path) ?? getImageSource(request.url);
  const title = titleImageSource ? 'Image payload' : request.normalizedPath;
  const displayUrl = titleImageSource ? summarizeImageUrl(request.url) : request.url;
  const markIndex = { value: 0 };

  appendPanelOccurrences(
    occurrences,
    request.id,
    markIndex,
    searchText,
    [
    { kind: 'text', text: title },
    { kind: 'text', text: request.host },
    ],
    options,
  );

  appendPanelOccurrences(
    occurrences,
    request.id,
    markIndex,
    searchText,
    [
    { kind: 'text', text: displayUrl },
    { kind: 'text', text: `${request.status || 'n/a'} ${request.statusText ?? ''}`.trim() },
    { kind: 'text', text: formatDuration(request.duration) },
    { kind: 'text', text: formatDateTime(request.startedAt) },
    { kind: 'text', text: request.type },
    { kind: 'text', text: request.mimeType ?? 'unknown' },
    ],
    options,
  );

  if (matchingSections.has('headers')) {
    appendPanelOccurrences(
      occurrences,
      request.id,
      markIndex,
      searchText,
      [
        { kind: 'json', value: request.requestHeaders ?? {} },
        { kind: 'json', value: request.responseHeaders ?? {} },
      ],
      options,
    );
  }

  if (matchingSections.has('payload')) {
    appendPanelOccurrences(
      occurrences,
      request.id,
      markIndex,
      searchText,
      [
        { kind: 'json', value: request.queryParams ?? {} },
        { kind: 'json', value: request.requestBody ?? 'Request payload is not available for this request.' },
      ],
      options,
    );
  }

  appendPanelOccurrences(
    occurrences,
    request.id,
    markIndex,
    searchText,
    [
      {
        kind: 'json',
        value: request.responsePreview ?? request.responseContent ?? 'Response body is not available.',
      },
    ],
    options,
  );

  if (matchingSections.has('timing')) {
    appendPanelOccurrences(
      occurrences,
      request.id,
      markIndex,
      searchText,
      [
        { kind: 'text', text: formatLocaleDateTime(request.startedAt) },
        { kind: 'text', text: formatLocaleDateTime(request.endedAt) },
        { kind: 'text', text: `${request.duration}ms` },
      ],
      options,
    );
  }

  if (matchingSections.has('replay')) {
    appendPanelOccurrences(
      occurrences,
      request.id,
      markIndex,
      searchText,
      [{ kind: 'text', text: generateCurl(request) }],
      options,
    );
  }

  return occurrences;
}

export function buildSearchOccurrences(
  requests: ApiRequest[],
  searchText: string,
  options?: SearchOptions,
): SearchOccurrence[] {
  if (!getSearchTerms(searchText, options).length) return [];

  return requests.flatMap((request) => buildRequestPanelOccurrences(request, searchText, options));
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

export function getMatchingDetailSections(
  request: ApiRequest,
  searchText: string,
  options?: SearchOptions,
): Set<string> {
  const sections = new Set<string>();
  if (!getSearchTerms(searchText, options).length) return sections;

  const matches = (text: string) => textMatchesSearch(text, searchText, options);

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
