import type { ApiRequest } from '../types/network';
import {
  formatRequestBodyLiteral,
  getReplayHeaders,
  hasReplayBody,
} from './requestCodeSnippets';

/**
 * 요청 재전송.
 *
 * 검사 대상 페이지 컨텍스트에서 fetch를 실행한다(chrome.devtools.inspectedWindow.eval).
 * 페이지에서 나가는 실제 요청이므로 쿠키·CORS가 원 요청과 동일하게 적용되고,
 * 재전송된 요청은 onRequestFinished로 다시 캡처되어 네트워크 스트림에 새 항목으로 나타난다.
 *
 * 응답은 여기서 기다리지 않는다(fire-and-forget) — eval은 Promise를 직렬화하지
 * 못하고, 결과는 어차피 네트워크 스트림에 잡히기 때문이다.
 */

export type ResendOutcome = { ok: true } | { ok: false; error: string };

/** http(s) 요청만 재전송 대상. data:/blob:/웹소켓 등은 제외. */
export function canResendRequest(request: ApiRequest): boolean {
  return /^https?:\/\//i.test(request.url) && request.type !== 'websocket';
}

function buildFetchInit(request: ApiRequest): RequestInit {
  const headers: Record<string, string> = {};
  for (const [name, value] of getReplayHeaders(request)) {
    headers[name] = value;
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    // 원 요청처럼 쿠키를 포함해 보낸다(교차 출처 포함).
    credentials: 'include',
  };

  const body = formatRequestBodyLiteral(request.requestBody);
  if (body !== null && hasReplayBody(request)) {
    init.body = body;
  }

  return init;
}

function canUseInspectedWindow(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.devtools?.inspectedWindow?.eval);
}

export function resendRequest(request: ApiRequest): Promise<ResendOutcome> {
  const init = buildFetchInit(request);

  if (!canUseInspectedWindow()) {
    // 로컬 개발(패널 단독 실행): 패널 컨텍스트에서 직접 전송한다.
    // 교차 출처면 CORS로 실패할 수 있으나 전송 자체는 시도된다.
    try {
      void fetch(request.url, init).catch(() => {});
      return Promise.resolve({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to resend request.';
      return Promise.resolve({ ok: false, error: message });
    }
  }

  // 금지 헤더(cookie 등)는 페이지 fetch가 조용히 무시하므로 그대로 넘겨도 안전하다.
  const expression = `(() => {
    try {
      fetch(${JSON.stringify(request.url)}, ${JSON.stringify(init)}).catch(() => {});
      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error && error.message || error) };
    }
  })()`;

  return new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval(expression, (result, exceptionInfo) => {
      if (exceptionInfo?.isException) {
        resolve({
          ok: false,
          error: exceptionInfo.value ?? exceptionInfo.description ?? 'Failed to resend request.',
        });
        return;
      }
      const outcome = result as Partial<ResendOutcome> | undefined;
      if (outcome && outcome.ok === false) {
        resolve({ ok: false, error: (outcome as { error?: string }).error ?? 'Failed to resend request.' });
        return;
      }
      resolve({ ok: true });
    });
  });
}
