import type { MessageKey } from '../i18n/ko';
import type { ApiRequest, ReplayDraft } from '../types/network';
import { draftHasBody, draftHeaderEntries } from './requestCodeSnippets';

/**
 * 요청 재전송.
 *
 * 검사 대상 페이지 컨텍스트에서 fetch를 실행한다(chrome.devtools.inspectedWindow.eval).
 * 페이지에서 나가는 실제 요청이므로 쿠키·CORS가 원 요청과 동일하게 적용되고,
 * 재전송된 요청은 onRequestFinished로 다시 캡처되어 네트워크 스트림에 새 항목으로 나타난다.
 *
 * 보내는 값은 캡처된 요청이 아니라 ReplayDraft다 — 사용자가 URL·메서드·헤더·본문을
 * 고쳐서 보낼 수 있고, 화면의 cURL/fetch 스니펫도 같은 draft로 만들어지므로
 * 미리보기와 실제 전송이 어긋나지 않는다.
 *
 * 응답은 여기서 기다리지 않는다(fire-and-forget) — eval은 Promise를 직렬화하지
 * 못하고, 결과는 어차피 네트워크 스트림에 잡히기 때문이다.
 */

// 검증 실패는 번역 키(errorKey)로, 런타임 fetch/eval 오류는 브라우저가 준 원문(error)으로
// 구분해 전달한다. UI에서 errorKey는 t()로 번역하고 error는 그대로 보여준다.
export type ResendOutcome =
  | { ok: true }
  | { ok: false; error?: string; errorKey?: MessageKey };

/** http(s) 요청만 재전송 대상. data:/blob:/웹소켓 등은 제외. */
export function canResendRequest(request: ApiRequest): boolean {
  return /^https?:\/\//i.test(request.url) && request.type !== 'websocket';
}

/** 전송 전 draft 검증. 문제가 없으면 null, 있으면 사용자에게 보여줄 메시지의 번역 키. */
export function validateReplayDraft(draft: ReplayDraft): MessageKey | null {
  if (!draft.method.trim()) return 'replay.error.methodRequired';
  if (!/^https?:\/\//i.test(draft.url.trim())) {
    return 'replay.error.urlScheme';
  }
  try {
    new URL(draft.url.trim());
  } catch {
    return 'replay.error.urlInvalid';
  }
  return null;
}

function buildFetchInit(draft: ReplayDraft): RequestInit {
  const headers: Record<string, string> = {};
  for (const [name, value] of draftHeaderEntries(draft)) {
    headers[name] = value;
  }

  const init: RequestInit = {
    method: draft.method.toUpperCase(),
    headers,
    // 원 요청처럼 쿠키를 포함해 보낸다(교차 출처 포함).
    credentials: 'include',
  };

  if (draftHasBody(draft)) {
    init.body = draft.body as string;
  }

  return init;
}

function canUseInspectedWindow(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.devtools?.inspectedWindow?.eval);
}

export function resendRequest(draft: ReplayDraft): Promise<ResendOutcome> {
  const invalidKey = validateReplayDraft(draft);
  if (invalidKey) return Promise.resolve({ ok: false, errorKey: invalidKey });

  const url = draft.url.trim();
  const init = buildFetchInit(draft);

  if (!canUseInspectedWindow()) {
    // 로컬 개발(패널 단독 실행): 패널 컨텍스트에서 직접 전송한다.
    // 교차 출처면 CORS로 실패할 수 있으나 전송 자체는 시도된다.
    try {
      void fetch(url, init).catch(() => {});
      return Promise.resolve({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to resend request.';
      return Promise.resolve({ ok: false, error: message });
    }
  }

  // 금지 헤더(cookie 등)는 페이지 fetch가 조용히 무시하므로 그대로 넘겨도 안전하다.
  const expression = `(() => {
    try {
      fetch(${JSON.stringify(url)}, ${JSON.stringify(init)}).catch(() => {});
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
