import type { CookieEntry, CookieSameSite, CookieSnapshot } from '../types/storage';

/**
 * DevTools 패널 측 쿠키 접근 유틸.
 *
 * chrome.cookies는 devtools 페이지에서 직접 못 쓰기 때문에, 백그라운드 워커(background.ts)에
 * runtime.sendMessage로 요청을 위임한다. 대상 페이지 URL은 inspectedWindow.eval로 가져온다.
 */

type CookieResponse =
  | { ok: true; cookies?: CookieEntry[] }
  | { ok: false; error: string };

export type CookieWriteInput = {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: CookieSameSite;
  hostOnly: boolean;
  expires: number | null;
};

export function canInspectCookies(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    Boolean(chrome.runtime?.sendMessage) &&
    Boolean(chrome.devtools?.inspectedWindow?.eval)
  );
}

function getInspectedUrl(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.devtools.inspectedWindow.eval('location.href', (result, exceptionInfo) => {
      if (exceptionInfo?.isException || typeof result !== 'string') {
        reject(new Error('Failed to read the inspected page URL.'));
        return;
      }
      resolve(result);
    });
  });
}

function sendCookieMessage(message: Record<string, unknown>): Promise<CookieResponse> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: CookieResponse | undefined) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message ?? 'Cookie request failed.'));
        return;
      }
      if (!response) {
        reject(new Error('No response from the extension background worker.'));
        return;
      }
      resolve(response);
    });
  });
}

export async function inspectCookies(): Promise<CookieSnapshot> {
  if (!canInspectCookies()) {
    throw new Error('Cookie inspection is available only inside the Chrome DevTools panel.');
  }

  const url = await getInspectedUrl();
  const response = await sendCookieMessage({ type: 'cookies:getAll', url });
  if (!response.ok) throw new Error(response.error);

  const cookies = (response.cookies ?? []).sort((a, b) => a.name.localeCompare(b.name));
  return {
    url,
    capturedAt: new Date().toISOString(),
    cookies,
    errors: [],
  };
}

export async function setCookie(cookie: CookieWriteInput): Promise<void> {
  if (!canInspectCookies()) {
    throw new Error('Cookie editing is available only inside the Chrome DevTools panel.');
  }
  const url = await getInspectedUrl();
  const response = await sendCookieMessage({ type: 'cookies:set', url, cookie });
  if (!response.ok) throw new Error(response.error);
}

export async function removeCookie(cookie: {
  name: string;
  domain: string;
  path: string;
  secure: boolean;
}): Promise<void> {
  if (!canInspectCookies()) {
    throw new Error('Cookie editing is available only inside the Chrome DevTools panel.');
  }
  await getInspectedUrl();
  const host = cookie.domain.replace(/^\./, '');
  const scheme = cookie.secure ? 'https' : 'http';
  const removalUrl = `${scheme}://${host}${cookie.path || '/'}`;
  const response = await sendCookieMessage({
    type: 'cookies:remove',
    url: removalUrl,
    name: cookie.name,
  });
  if (!response.ok) throw new Error(response.error);
}
