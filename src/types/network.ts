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

export type NetworkCookie = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  /** HAR 형식의 만료 시각 문자열(ISO). 세션 쿠키면 없음. */
  expires?: string | null;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
};

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
  requestCookies?: NetworkCookie[];
  responseCookies?: NetworkCookie[];
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
  /** 응답 본문 크기(bytes). 알 수 없으면 없음. 정렬용으로 보관. */
  size?: number;
  isSlow: boolean;
  isError: boolean;
};
