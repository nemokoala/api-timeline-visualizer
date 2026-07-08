/**
 * MV3 service worker.
 *
 * DevTools 패널(devtools 페이지)에서는 chrome.cookies API를 직접 호출할 수 없어서,
 * 이 백그라운드 워커가 chrome.cookies 접근을 대행한다. 패널이 runtime.sendMessage로
 * 요청을 보내면 여기서 처리해 응답을 돌려준다.
 */

import type { CookieEntry, CookieSameSite } from './src/types/storage';

type CookieMessage =
  | { type: 'cookies:getAll'; url: string }
  | { type: 'cookies:set'; url: string; cookie: CookieWriteInput }
  | { type: 'cookies:remove'; url: string; name: string; storeId?: string };

type CookieWriteInput = {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: CookieSameSite;
  hostOnly: boolean;
  /** 만료 시각(epoch seconds). null이면 세션 쿠키. */
  expires: number | null;
  storeId?: string;
};

type CookieResponse =
  | { ok: true; cookies?: CookieEntry[] }
  | { ok: false; error: string };

const utf8ByteSize = (value: string): number => {
  try {
    return new TextEncoder().encode(value).length;
  } catch {
    return value.length;
  }
};

const toSameSite = (value: chrome.cookies.SameSiteStatus | undefined): CookieSameSite => {
  switch (value) {
    case 'strict':
      return 'strict';
    case 'lax':
      return 'lax';
    case 'no_restriction':
      return 'none';
    default:
      return 'unspecified';
  }
};

const fromSameSite = (value: CookieSameSite): chrome.cookies.SameSiteStatus => {
  switch (value) {
    case 'strict':
      return 'strict';
    case 'lax':
      return 'lax';
    case 'none':
      return 'no_restriction';
    default:
      return 'unspecified';
  }
};

const toEntry = (cookie: chrome.cookies.Cookie): CookieEntry => ({
  name: cookie.name,
  value: cookie.value,
  domain: cookie.domain,
  path: cookie.path,
  expires: cookie.session ? null : Math.round(cookie.expirationDate ?? 0),
  size: utf8ByteSize(cookie.name) + utf8ByteSize(cookie.value),
  httpOnly: cookie.httpOnly,
  secure: cookie.secure,
  sameSite: toSameSite(cookie.sameSite),
  hostOnly: cookie.hostOnly,
});

/** 쿠키의 도메인/경로/보안 속성으로 set·remove에 쓸 URL을 만든다. */
const cookieUrl = (cookie: {
  domain: string;
  path: string;
  secure: boolean;
}): string => {
  const host = cookie.domain.replace(/^\./, '');
  const scheme = cookie.secure ? 'https' : 'http';
  return `${scheme}://${host}${cookie.path || '/'}`;
};

async function handleMessage(message: CookieMessage): Promise<CookieResponse> {
  if (!chrome.cookies) {
    throw new Error(
      'chrome.cookies API is unavailable. Reload the extension at chrome://extensions to grant the "cookies" permission.',
    );
  }

  if (message.type === 'cookies:getAll') {
    const cookies = await chrome.cookies.getAll({ url: message.url });
    return { ok: true, cookies: cookies.map(toEntry) };
  }

  if (message.type === 'cookies:set') {
    const input = message.cookie;
    const details: chrome.cookies.SetDetails = {
      url: cookieUrl(input),
      name: input.name,
      value: input.value,
      path: input.path,
      secure: input.secure,
      httpOnly: input.httpOnly,
      sameSite: fromSameSite(input.sameSite),
    };
    // hostOnly 쿠키는 domain을 지정하면 안 된다(지정 시 도메인 쿠키가 됨).
    if (!input.hostOnly && input.domain) {
      details.domain = input.domain;
    }
    if (input.expires !== null) {
      details.expirationDate = input.expires;
    }
    if (input.storeId) {
      details.storeId = input.storeId;
    }

    const result = await chrome.cookies.set(details);
    if (!result) {
      throw new Error('Cookie was rejected by the browser (check Secure/SameSite/domain).');
    }
    return { ok: true };
  }

  if (message.type === 'cookies:remove') {
    await chrome.cookies.remove({
      url: message.url,
      name: message.name,
      ...(message.storeId ? { storeId: message.storeId } : {}),
    });
    return { ok: true };
  }

  return { ok: false, error: 'Unknown cookie message.' };
}

chrome.runtime.onMessage.addListener((message: CookieMessage, _sender, sendResponse) => {
  if (!message || typeof message.type !== 'string' || !message.type.startsWith('cookies:')) {
    return false;
  }

  handleMessage(message)
    .then(sendResponse)
    .catch((error: unknown) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });

  // 비동기 응답을 위해 채널을 열어둔다.
  return true;
});
