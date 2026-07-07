import type { ApiRequest, HeaderMap, RequestKind } from '../types/network';
import type { DevtoolsNetworkRequest, HarHeader, HarPostData } from '../types/chrome-har';
import { getUrlParts } from './normalizeUrl';
import { matchesIncludeExcludeFilters } from './textFilters';

const INCLUDE_PATTERNS = ['/api', '/graphql', '/v1', '/v2'];
const EXCLUDE_PATTERNS = ['google-analytics', 'sentry', 'datadog', 'amplitude', 'hotjar', 'segment'];

// 정적 리소스(css/js/이미지/폰트/미디어)까지 수집하되, 표시 여부는 뷰의 리소스 타입 토글에서
// 거른다. 여기서는 인식 가능한 모든 종류를 저장소에 담아 두어 토글을 켤 때 과거 요청까지
// 소급 표시되게 한다. 알 수 없는 종류('other')만 api/graphql 패턴으로 한 번 더 좁힌다.
export function shouldCollectRequest(request: DevtoolsNetworkRequest): boolean {
  const url = request.request?.url ?? '';
  const lowerUrl = url.toLowerCase();
  const resourceType = getRequestKind(request);

  if (EXCLUDE_PATTERNS.some((pattern) => lowerUrl.includes(pattern))) return false;
  if (resourceType !== 'other') return true;

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
  if (resourceType === 'stylesheet') return 'stylesheet';
  if (resourceType === 'script') return 'script';
  if (resourceType === 'image') return 'image';
  if (resourceType === 'font') return 'font';
  if (resourceType === 'media') return 'media';

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

function getErrorLabel(status: number): string | undefined {
  if (status >= 500) return 'Server error';
  if (status >= 400) return 'Client error';
  if (status === 0) return 'No response status';
  return undefined;
}
