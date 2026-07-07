export type RequestKind =
  | 'fetch'
  | 'xhr'
  | 'document'
  | 'websocket'
  | 'stylesheet'
  | 'script'
  | 'image'
  | 'font'
  | 'media'
  | 'other';

export type HeaderMap = Record<string, string>;

export type ApiRequest = {
  id: string;
  url: string;
  host: string;
  path: string;
  normalizedPath: string;
  method: string;
  status: number;
  statusText?: string;
  startedAt: number;
  endedAt: number;
  duration: number;
  type: RequestKind;
  mimeType?: string;
  requestHeaders?: HeaderMap;
  responseHeaders?: HeaderMap;
  queryParams?: HeaderMap;
  requestBody?: unknown;
  responsePreview?: unknown;
  responseContent?: string;
  size?: number;
  error?: string;
};

export type TimelineItem = {
  id: string;
  requestId: string;
  label: string;
  startOffset: number;
  duration: number;
  status: number;
  method: string;
  host: string;
  path: string;
  normalizedPath: string;
  isSlow: boolean;
  isError: boolean;
};
