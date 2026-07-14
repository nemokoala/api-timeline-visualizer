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

/** 프레임의 방향. 'status'는 데이터가 아니라 연결 상태 변화(open/close/error)다. */
export type WebSocketFrameDirection = 'sent' | 'received' | 'status';

export type WebSocketFrameKind = 'text' | 'binary' | 'open' | 'close' | 'error';

/**
 * WebSocket 프레임 하나(또는 연결 상태 변화 한 줄).
 * 바이너리 프레임은 내용을 옮기지 않고 크기만 재서 text에 요약 문구를 담는다.
 */
export type WebSocketFrame = {
  id: string;
  direction: WebSocketFrameDirection;
  kind: WebSocketFrameKind;
  timestamp: number;
  /** 페이로드 바이트 수. 상태 프레임은 0. */
  size: number;
  /** 표시용 원문. 바이너리·상태 프레임은 요약 문구가 들어간다. */
  text: string;
  /** text가 JSON으로 파싱되면 그 값. 아니면 없음(= 평문으로 표시). */
  preview?: unknown;
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
  /** WebSocket 연결의 송수신 프레임(type === 'websocket'일 때만). */
  frames?: WebSocketFrame[];
  /** 프레임 상한을 넘겨 버린 오래된 프레임 수. 0이면 없음. */
  droppedFrameCount?: number;
  /** WebSocket 연결이 아직 열려 있는지. 닫혔거나 실패했으면 false. */
  isOpen?: boolean;
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
