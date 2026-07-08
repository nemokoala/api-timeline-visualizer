import type { ApiRequest, NetworkCookie } from '../types/network';

/**
 * 요청/응답 쿠키를 상세 패널 렌더와 검색 하이라이트 카운트가 동일하게 쓰도록
 * "표시용 값"을 만드는 공유 헬퍼. 두 곳이 다른 값을 쓰면 하이라이트 인덱스가 어긋난다.
 * (헤더 섹션과 동일한 JsonViewer 기반 표현을 사용한다.)
 */

/** 요청 쿠키는 name=value 뿐이라 헤더처럼 맵으로 표현한다. 없으면 빈 객체. */
export function requestCookieValue(request: ApiRequest): unknown {
  const cookies = request.requestCookies ?? [];
  if (!cookies.length) return {};
  return Object.fromEntries(cookies.map((cookie) => [cookie.name, cookie.value]));
}

/** 응답 쿠키는 속성이 있어 객체 배열로 표현한다. 없으면 빈 배열. */
export function responseCookieValue(request: ApiRequest): unknown {
  const cookies = request.responseCookies ?? [];
  if (!cookies.length) return [];
  return cookies.map(cookieToDisplay);
}

function cookieToDisplay(cookie: NetworkCookie): Record<string, unknown> {
  const display: Record<string, unknown> = { name: cookie.name, value: cookie.value };
  if (cookie.domain) display.domain = cookie.domain;
  if (cookie.path) display.path = cookie.path;
  if (cookie.expires) display.expires = cookie.expires;
  if (cookie.httpOnly) display.httpOnly = true;
  if (cookie.secure) display.secure = true;
  if (cookie.sameSite) display.sameSite = cookie.sameSite;
  return display;
}
