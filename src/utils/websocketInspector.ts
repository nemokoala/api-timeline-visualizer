import type { WebSocketFrame } from '../types/network';

/**
 * WebSocket 프레임 캡처.
 *
 * chrome.devtools.network는 HAR 엔트리(= 끝난 HTTP 요청)만 주므로 WS 프레임을 볼 수 없다.
 * 그래서 콘솔 캡처(consoleInspector)와 같은 방식으로, 검사 대상 페이지의 window.WebSocket을
 * Proxy로 감싸 send/message/open/close/error를 페이지 쪽 버퍼에 쌓고 패널이 폴링으로 비운다.
 *
 * 한계: 훅이 주입되기 전에 이미 열린 소켓과, Worker 안에서 만든 소켓은 잡히지 않는다.
 */

const POLL_INTERVAL_MS = 400;
/** 페이지 쪽 버퍼 상한(폭주 방어). drain은 통째로 비우므로 평소엔 훨씬 작다. */
const PAGE_BUFFER_MAX = 5000;
/** 프레임 하나에서 옮겨올 텍스트 상한. 넘으면 잘라서 보낸다. */
const MAX_FRAME_TEXT = 20000;

export type WebSocketConnectionEvent = {
  type: 'connection';
  socketId: string;
  url: string;
  protocols?: string;
  timestamp: number;
};

export type WebSocketFrameEvent = {
  type: 'frame';
  socketId: string;
  url: string;
  frame: WebSocketFrame;
};

export type WebSocketEvent = WebSocketConnectionEvent | WebSocketFrameEvent;

export function canInspectWebSockets(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.devtools?.inspectedWindow?.eval);
}

export function getWebSocketPollInterval(): number {
  return POLL_INTERVAL_MS;
}

export async function installWebSocketCapture(): Promise<void> {
  if (!canInspectWebSockets()) {
    throw new Error('WebSocket capture is available only inside the Chrome DevTools panel.');
  }

  await evalInInspectedPage(INSTALL_SCRIPT);
}

export type WebSocketDrainResult = {
  /** 페이지에 훅이 살아있는지. 새로고침되면 false — 호출부가 재설치해야 한다. */
  installed: boolean;
  events: WebSocketEvent[];
};

export async function drainWebSocketEvents(): Promise<WebSocketDrainResult> {
  if (!canInspectWebSockets()) return { installed: false, events: [] };

  const raw = await evalInInspectedPage(
    `window.__DEVLENS_WS_INSTALLED__
      ? { installed: true, events: window.__DEVLENS_WS_DRAIN__() }
      : { installed: false, events: [] }`,
  );

  const result = (raw && typeof raw === 'object' ? raw : {}) as {
    installed?: unknown;
    events?: unknown;
  };

  return {
    installed: result.installed === true,
    events: normalizeEvents(result.events),
  };
}

function evalInInspectedPage(expression: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    chrome.devtools.inspectedWindow.eval(expression, (result, exceptionInfo) => {
      if (exceptionInfo?.isException) {
        reject(
          new Error(
            exceptionInfo.value ?? exceptionInfo.description ?? 'Failed to inspect page WebSockets.',
          ),
        );
        return;
      }

      resolve(result);
    });
  });
}

function normalizeEvents(value: unknown): WebSocketEvent[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): WebSocketEvent[] => {
    if (!item || typeof item !== 'object') return [];
    const event = item as Record<string, unknown>;
    if (typeof event.socketId !== 'string' || typeof event.url !== 'string') return [];

    if (event.type === 'connection') {
      return [
        {
          type: 'connection',
          socketId: event.socketId,
          url: event.url,
          protocols: typeof event.protocols === 'string' ? event.protocols : undefined,
          timestamp: typeof event.timestamp === 'number' ? event.timestamp : Date.now(),
        },
      ];
    }

    if (event.type === 'frame') {
      const frame = normalizeFrame(event.frame);
      if (!frame) return [];
      return [{ type: 'frame', socketId: event.socketId, url: event.url, frame }];
    }

    return [];
  });
}

function normalizeFrame(value: unknown): WebSocketFrame | null {
  if (!value || typeof value !== 'object') return null;
  const frame = value as Record<string, unknown>;

  if (
    typeof frame.id !== 'string' ||
    typeof frame.text !== 'string' ||
    typeof frame.timestamp !== 'number'
  ) {
    return null;
  }

  const direction = frame.direction;
  const kind = frame.kind;
  if (direction !== 'sent' && direction !== 'received' && direction !== 'status') return null;
  if (kind !== 'text' && kind !== 'binary' && kind !== 'open' && kind !== 'close' && kind !== 'error') {
    return null;
  }

  return {
    id: frame.id,
    direction,
    kind,
    timestamp: frame.timestamp,
    size: typeof frame.size === 'number' ? frame.size : 0,
    text: frame.text,
    preview: parseFramePreview(frame.text, kind),
  };
}

/** 텍스트 프레임이 JSON이면 파싱해 둔다(JsonViewer가 트리로 그린다). 아니면 평문 그대로. */
function parseFramePreview(text: string, kind: WebSocketFrame['kind']): unknown {
  if (kind !== 'text') return undefined;

  const trimmed = text.trim();
  const looksLikeJson =
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'));
  if (!looksLikeJson) return undefined;

  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

/**
 * 페이지에 주입되는 스크립트. window.WebSocket을 Proxy로 감싸므로
 * instanceof·정적 상수(WebSocket.OPEN 등)는 원본 그대로 동작한다.
 */
const INSTALL_SCRIPT = `
(() => {
  if (window.__DEVLENS_WS_INSTALLED__) return true;
  window.__DEVLENS_WS_INSTALLED__ = true;

  const NativeWebSocket = window.WebSocket;
  if (typeof NativeWebSocket !== 'function') return true;

  const buffer = (window.__DEVLENS_WS_BUFFER__ = []);
  let socketSeq = 0;
  let frameSeq = 0;

  const push = (event) => {
    if (buffer.length >= ${PAGE_BUFFER_MAX}) buffer.shift();
    buffer.push(event);
  };

  window.__DEVLENS_WS_DRAIN__ = () => {
    if (!buffer.length) return [];
    return buffer.splice(0, buffer.length);
  };

  const byteSize = (text) => {
    try {
      return new TextEncoder().encode(text).length;
    } catch {
      return text.length;
    }
  };

  const formatBytes = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  /** 페이로드를 { kind, size, text }로 요약한다. 바이너리는 크기만 재고 내용은 옮기지 않는다. */
  const describe = (data) => {
    if (typeof data === 'string') {
      const size = byteSize(data);
      const text =
        data.length > ${MAX_FRAME_TEXT}
          ? data.slice(0, ${MAX_FRAME_TEXT}) + '\\n\\n[truncated ' + data.length + ' chars]'
          : data;
      return { kind: 'text', size, text };
    }

    if (data instanceof ArrayBuffer) {
      return { kind: 'binary', size: data.byteLength, text: '[Binary ' + formatBytes(data.byteLength) + ']' };
    }

    if (typeof Blob !== 'undefined' && data instanceof Blob) {
      return { kind: 'binary', size: data.size, text: '[Blob ' + formatBytes(data.size) + ']' };
    }

    if (data && typeof data === 'object' && typeof data.byteLength === 'number') {
      return { kind: 'binary', size: data.byteLength, text: '[Binary ' + formatBytes(data.byteLength) + ']' };
    }

    const fallback = String(data);
    return { kind: 'text', size: byteSize(fallback), text: fallback };
  };

  const pushFrame = (socket, direction, payload) => {
    const described = describe(payload);
    frameSeq += 1;
    push({
      type: 'frame',
      socketId: socket.__devlensId,
      url: socket.url || socket.__devlensUrl,
      frame: {
        id: socket.__devlensId + '_f' + frameSeq,
        direction,
        kind: described.kind,
        timestamp: Date.now(),
        size: described.size,
        text: described.text,
      },
    });
  };

  const pushStatus = (socket, kind, text) => {
    frameSeq += 1;
    push({
      type: 'frame',
      socketId: socket.__devlensId,
      url: socket.url || socket.__devlensUrl,
      frame: {
        id: socket.__devlensId + '_f' + frameSeq,
        direction: 'status',
        kind,
        timestamp: Date.now(),
        size: 0,
        text,
      },
    });
  };

  const instrument = (socket, args) => {
    socketSeq += 1;
    const socketId = 'ws_' + Date.now() + '_' + socketSeq;
    socket.__devlensId = socketId;
    socket.__devlensUrl = String(args[0] ?? socket.url ?? '');

    const protocols = args[1];
    push({
      type: 'connection',
      socketId,
      url: socket.url || socket.__devlensUrl,
      protocols: protocols === undefined ? undefined : String(protocols),
      timestamp: Date.now(),
    });

    // 페이지 코드보다 먼저 등록되므로 어떤 메시지도 놓치지 않는다.
    socket.addEventListener('open', () => pushStatus(socket, 'open', 'Connection opened'));
    socket.addEventListener('message', (event) => pushFrame(socket, 'received', event.data));
    socket.addEventListener('close', (event) => {
      const reason = event && event.reason ? ' ' + event.reason : '';
      const code = event && typeof event.code === 'number' ? event.code : 1000;
      pushStatus(socket, 'close', 'Connection closed (' + code + ')' + reason);
    });
    socket.addEventListener('error', () => pushStatus(socket, 'error', 'Connection error'));

    const nativeSend = socket.send;
    socket.send = function (data) {
      try {
        pushFrame(socket, 'sent', data);
      } catch {
        // 캡처 실패가 페이지의 send를 막지 않게 한다.
      }
      return nativeSend.call(this, data);
    };
  };

  window.WebSocket = new Proxy(NativeWebSocket, {
    construct(target, args) {
      const socket = Reflect.construct(target, args, target);
      try {
        instrument(socket, args);
      } catch {
        // 계측 실패해도 소켓 자체는 정상 동작해야 한다.
      }
      return socket;
    },
  });

  return true;
})()
`;
