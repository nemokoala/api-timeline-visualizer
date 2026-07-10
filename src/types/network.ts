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

export type RequestTimingPhase =
  | 'blocked'
  | 'dns'
  | 'connect'
  | 'ssl'
  | 'send'
  | 'wait'
  | 'receive';

/** 실제로 발생한 타이밍 구간 하나. duration은 ms. */
export type RequestTimingSegment = {
  phase: RequestTimingPhase;
  duration: number;
};

/**
 * 정규화된 요청 타이밍. -1(해당 없음)·누락 구간은 빠져 있고,
 * segments는 HAR 순서(blocked→receive)대로 담긴다.
 * 총 소요는 ApiRequest.duration이 원본이며, 여기 합은 그 이하로 잘려 있다.
 */
export type RequestTimings = {
  segments: RequestTimingSegment[];
};

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
  /** 단계별 소요(연결 수립/대기/수신 등). 쓸 만한 HAR 타이밍이 없으면 없음. */
  timings?: RequestTimings;
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
  /** 단계별 소요. 있으면 타임라인 바를 색 구간으로 나눠 그린다. */
  timings?: RequestTimings;
  isSlow: boolean;
  isError: boolean;
};
