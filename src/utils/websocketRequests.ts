import type { ApiRequest, WebSocketFrame } from '../types/network';
import type { WebSocketEvent } from './websocketInspector';
import { getUrlParts } from './normalizeUrl';

/** 연결 하나가 보관하는 프레임 상한. 넘으면 오래된 것부터 버리고 droppedFrameCount에 센다. */
export const WS_FRAME_MAX = 2000;

/**
 * 캡처된 WebSocket 이벤트를 요청 목록에 합친다.
 *
 * WS 연결은 HTTP 요청과 달리 "끝난 뒤 한 번"이 아니라 살아있는 동안 계속 갱신되므로,
 * 같은 소켓(id)의 기존 항목을 제자리에서 갱신한다(목록 순서 유지).
 * 항목이 없으면 새로 만든다 — Clear 이후에도 진행 중인 소켓이 다시 나타나게.
 */
export function applyWebSocketEvents(requests: ApiRequest[], events: WebSocketEvent[]): ApiRequest[] {
  if (!events.length) return requests;

  const indexById = new Map<string, number>();
  requests.forEach((request, index) => indexById.set(request.id, index));

  const next = [...requests];

  const upsert = (socketId: string, url: string, timestamp: number): ApiRequest => {
    const index = indexById.get(socketId);
    if (index !== undefined) return next[index];

    const created = createConnectionRequest(socketId, url, timestamp);
    indexById.set(socketId, next.length);
    next.push(created);
    return created;
  };

  const replace = (socketId: string, request: ApiRequest) => {
    const index = indexById.get(socketId);
    if (index !== undefined) next[index] = request;
  };

  for (const event of events) {
    if (event.type === 'connection') {
      upsert(event.socketId, event.url, event.timestamp);
      continue;
    }

    const current = upsert(event.socketId, event.url, event.frame.timestamp);
    replace(event.socketId, applyFrame(current, event.frame));
  }

  return next;
}

function createConnectionRequest(socketId: string, url: string, timestamp: number): ApiRequest {
  const urlParts = getUrlParts(url);

  return {
    id: socketId,
    url,
    host: urlParts.host,
    path: urlParts.path,
    normalizedPath: urlParts.normalizedPath,
    // 핸드셰이크는 GET + 101이다. 실패하면 아래 applyFrame이 status를 0으로 되돌린다.
    method: 'GET',
    status: 101,
    statusText: 'Switching Protocols',
    startedAt: timestamp,
    endedAt: timestamp,
    duration: 0,
    type: 'websocket',
    queryParams: urlParts.queryParams,
    frames: [],
    droppedFrameCount: 0,
    isOpen: true,
  };
}

function applyFrame(request: ApiRequest, frame: WebSocketFrame): ApiRequest {
  const frames = [...(request.frames ?? []), frame];
  const overflow = Math.max(0, frames.length - WS_FRAME_MAX);
  if (overflow > 0) frames.splice(0, overflow);

  const next: ApiRequest = {
    ...request,
    frames,
    droppedFrameCount: (request.droppedFrameCount ?? 0) + overflow,
    // 연결이 살아있는 동안에도 타임라인에 길이가 생기도록 마지막 활동까지로 늘린다.
    endedAt: Math.max(request.endedAt, frame.timestamp),
    duration: Math.max(0, Math.max(request.endedAt, frame.timestamp) - request.startedAt),
    size: (request.size ?? 0) + frame.size,
  };

  if (frame.kind === 'close') {
    next.isOpen = false;
  }

  if (frame.kind === 'error') {
    next.isOpen = false;
    // open을 한 번도 못 봤으면 핸드셰이크 자체가 실패한 것 — 101을 취소한다.
    const opened = frames.some((item) => item.kind === 'open');
    if (!opened) {
      next.status = 0;
      next.statusText = undefined;
    }
    next.error = 'WebSocket connection error';
  }

  return next;
}

/** 열려 있는 연결과 닫힌 연결 각각의 프레임 수 요약(상세 패널 헤더용). */
export function countFrames(frames: WebSocketFrame[]): { sent: number; received: number } {
  let sent = 0;
  let received = 0;
  for (const frame of frames) {
    if (frame.direction === 'sent') sent += 1;
    else if (frame.direction === 'received') received += 1;
  }
  return { sent, received };
}
