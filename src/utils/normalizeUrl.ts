/**
 * 화면에 보여줄 경로. 기본은 실제 값(`path`)이고, collapseIds가 켜지면 정규화 값
 * (`:id`·`:date`·`:hash`)을 쓴다. 그룹화·diff 후보 판정 등 로직은 이 함수와 무관하게
 * 언제나 `normalizedPath`를 그대로 쓴다 — 표시 방식만 바꾼다.
 */
export function displayPath(
  parts: { path: string; normalizedPath: string },
  collapseIds: boolean,
): string {
  return collapseIds ? parts.normalizedPath : parts.path;
}

export function normalizePath(path: string): string {
  return path
    .split('/')
    .map((segment) => {
      if (/^\d+$/.test(segment)) return ':id';
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment)) {
        return ':id';
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(segment)) return ':date';
      if (/^[0-9a-f]{16,}$/i.test(segment)) return ':hash';
      return segment;
    })
    .join('/');
}

export function getUrlParts(rawUrl: string) {
  // data: URL(예: 인라인 base64 이미지)은 pathname이 통째로 수 MB가 될 수 있다.
  // path/normalizedPath에 base64 원문을 그대로 넣으면 필터·렌더·검색이 전부 폭증하므로
  // MIME까지만 담은 짧은 라벨로 압축한다. 원본 data URL은 request.url에 그대로 남는다.
  if (rawUrl.startsWith('data:')) {
    const mime = rawUrl.slice(5).split(/[;,]/, 1)[0] || 'data';
    const label = `data:${mime}`;
    return { host: 'data:', path: label, normalizedPath: label, queryParams: {} };
  }

  try {
    const parsed = new URL(rawUrl);

    return {
      host: parsed.host,
      path: parsed.pathname || '/',
      normalizedPath: normalizePath(parsed.pathname || '/'),
      queryParams: Object.fromEntries(parsed.searchParams.entries()),
    };
  } catch {
    return {
      host: 'unknown',
      path: rawUrl,
      normalizedPath: rawUrl,
      queryParams: {},
    };
  }
}
