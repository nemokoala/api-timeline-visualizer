import type { ApiRequest, HeaderMap, RequestKind } from '../types/network';
import type { DevtoolsNetworkRequest, HarHeader, HarPostData } from '../types/chrome-har';
import { getUrlParts } from './normalizeUrl';
import { matchesIncludeExcludeFilters } from './textFilters';

const EXCLUDED_RESOURCE_TYPES = new Set(['image', 'font', 'stylesheet', 'script', 'media']);
const INCLUDED_RESOURCE_TYPES = new Set(['fetch', 'xhr', 'document', 'websocket']);

const INCLUDE_PATTERNS = ['/api', '/graphql', '/v1', '/v2'];
const EXCLUDE_PATTERNS = ['google-analytics', 'sentry', 'datadog', 'amplitude', 'hotjar', 'segment'];
const STATIC_ASSET_EXTENSIONS = [
  '.js',
  '.mjs',
  '.css',
  '.map',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.mp4',
  '.webm',
  '.mp3',
];

export function shouldCollectRequest(request: DevtoolsNetworkRequest): boolean {
  const url = request.request?.url ?? '';
  const lowerUrl = url.toLowerCase();
  const resourceType = getRequestKind(request);

  if (EXCLUDED_RESOURCE_TYPES.has(resourceType)) return false;
  if (EXCLUDE_PATTERNS.some((pattern) => lowerUrl.includes(pattern))) return false;
  if (isStaticAssetUrl(lowerUrl)) return false;
  if (isStaticMimeType(request.response?.content?.mimeType)) return false;
  if (INCLUDED_RESOURCE_TYPES.has(resourceType)) return true;

  return INCLUDE_PATTERNS.some((pattern) => lowerUrl.includes(pattern));
}

export function matchesTextFilters(
  request: ApiRequest,
  includeText: string,
  excludeText: string,
): boolean {
  const haystack = `${request.url} ${request.host} ${request.path} ${request.normalizedPath}`.toLowerCase();
  return matchesIncludeExcludeFilters(haystack, includeText, excludeText);
}

export function parseNetworkRequest(request: DevtoolsNetworkRequest): ApiRequest {
  const rawUrl = request.request?.url ?? 'unknown';
  const urlParts = getUrlParts(rawUrl);
  const startedAt = request.startedDateTime ? new Date(request.startedDateTime).getTime() : Date.now();
  const duration = Math.max(0, Math.round(request.time ?? 0));
  const endedAt = startedAt + duration;
  const responseStatus = request.response?.status ?? 0;
  const requestBody = parsePostData(request.request?.postData);
  const responsePreview = parseResponsePreview(request.response?.content?.text, request.response?.content?.mimeType);

  return {
    id: `${startedAt}-${duration}-${rawUrl}`,
    url: rawUrl,
    host: urlParts.host,
    path: urlParts.path,
    normalizedPath: urlParts.normalizedPath,
    method: request.request?.method ?? 'GET',
    status: responseStatus,
    statusText: request.response?.statusText,
    startedAt,
    endedAt,
    duration,
    type: getRequestKind(request),
    mimeType: request.response?.content?.mimeType,
    requestHeaders: headersToMap(request.request?.headers),
    responseHeaders: headersToMap(request.response?.headers),
    queryParams: urlParts.queryParams,
    requestBody,
    responsePreview,
    size: request.response?.content?.size,
    error: getErrorLabel(responseStatus),
  };
}

export function parseResponseContent(content: string, mimeType?: string): unknown {
  if (!content) return 'Response body is empty.';

  if (mimeType?.includes('json') || looksLikeJson(content)) {
    try {
      return JSON.parse(content);
    } catch {
      return content;
    }
  }

  return content;
}

function getRequestKind(request: DevtoolsNetworkRequest): RequestKind {
  const resourceType = request._resourceType?.toLowerCase();

  if (resourceType === 'fetch') return 'fetch';
  if (resourceType === 'xhr') return 'xhr';
  if (resourceType === 'document') return 'document';
  if (resourceType === 'websocket') return 'websocket';

  return 'other';
}

function headersToMap(headers?: HarHeader[]): HeaderMap {
  if (!headers?.length) return {};

  return headers.reduce<HeaderMap>((acc, header) => {
    acc[header.name] = header.value;
    return acc;
  }, {});
}

function parsePostData(postData?: HarPostData): unknown {
  if (!postData) return undefined;
  if (postData.params?.length) {
    return Object.fromEntries(postData.params.map((param) => [param.name, param.value ?? '']));
  }
  if (!postData.text) return undefined;

  if (postData.mimeType?.includes('json') || looksLikeJson(postData.text)) {
    try {
      return JSON.parse(postData.text);
    } catch {
      return postData.text;
    }
  }

  return postData.text;
}

function parseResponsePreview(text?: string, mimeType?: string): unknown {
  if (!text) return undefined;
  const preview = text.length > 3000 ? `${text.slice(0, 3000)}\n\nResponse preview truncated.` : text;

  return parseResponseContent(preview, mimeType);
}

function looksLikeJson(value: string): boolean {
  const trimmed = value.trim();
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'));
}

function isStaticAssetUrl(url: string): boolean {
  const path = getUrlParts(url).path.toLowerCase();
  return STATIC_ASSET_EXTENSIONS.some((extension) => path.endsWith(extension));
}

function isStaticMimeType(mimeType?: string): boolean {
  if (!mimeType) return false;
  const normalized = mimeType.toLowerCase();

  return (
    normalized.includes('javascript') ||
    normalized.includes('text/css') ||
    normalized.startsWith('image/') ||
    normalized.startsWith('font/') ||
    normalized.startsWith('video/') ||
    normalized.startsWith('audio/')
  );
}

function getErrorLabel(status: number): string | undefined {
  if (status >= 500) return 'Server error';
  if (status >= 400) return 'Client error';
  if (status === 0) return 'No response status';
  return undefined;
}
