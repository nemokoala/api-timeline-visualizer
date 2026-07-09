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

/** 편집 가능한 헤더 한 줄. id는 편집 UI의 React key 용도로만 쓴다. */
export type ReplayHeader = {
  id: string;
  name: string;
  value: string;
};

/**
 * 재전송할 요청의 편집 가능한 사본.
 * cURL/fetch 스니펫과 실제 재전송이 모두 이 값을 읽으므로 미리보기와 전송이 항상 일치한다.
 */
export type ReplayDraft = {
  url: string;
  method: string;
  headers: ReplayHeader[];
  /** 본문 원문. 본문이 없으면 null. */
  body: string | null;
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
