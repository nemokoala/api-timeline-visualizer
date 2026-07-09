import type { ApiRequest, ReplayDraft, ReplayHeader } from '../types/network';

const SKIP_HEADERS = new Set(['host', 'connection', 'content-length', 'accept-encoding']);

function shouldIncludeHeader(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower.startsWith(':')) return false;
  return !SKIP_HEADERS.has(lower);
}

let headerSeq = 0;

export function createReplayHeader(name = '', value = ''): ReplayHeader {
  headerSeq += 1;
  return { id: `header-${headerSeq}`, name, value };
}

/** 재현(cURL/fetch/재전송)에 포함할 요청 헤더 목록. 의사 헤더·전송 관련 헤더는 제외. */
function getReplayHeaders(request: ApiRequest): ReplayHeader[] {
  return Object.entries(request.requestHeaders ?? {})
    .filter(([name]) => shouldIncludeHeader(name))
    .map(([name, value]) => createReplayHeader(name, value));
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function formatRequestBodyLiteral(body: unknown): string | null {
  if (body === undefined || body === null) return null;
  if (typeof body === 'string') return body;
  if (typeof body === 'object') return JSON.stringify(body);
  return String(body);
}

/** 캡처된 요청에서 편집 가능한 재전송 초안을 만든다. */
export function buildReplayDraft(request: ApiRequest): ReplayDraft {
  return {
    url: request.url,
    method: request.method,
    headers: getReplayHeaders(request),
    body: formatRequestBodyLiteral(request.requestBody),
  };
}

/** 전송 시 본문을 실어야 하는지(GET/HEAD와 빈 본문은 제외). */
export function draftHasBody(draft: ReplayDraft): boolean {
  const method = draft.method.toUpperCase();
  return Boolean(draft.body) && method !== 'GET' && method !== 'HEAD';
}

/** 이름이 빈 줄은 버린, 실제 전송용 헤더. */
export function draftHeaderEntries(draft: ReplayDraft): Array<[string, string]> {
  return draft.headers
    .map(({ name, value }): [string, string] => [name.trim(), value])
    .filter(([name]) => name.length > 0);
}

export function generateCurl(draft: ReplayDraft): string {
  const parts = ['curl', '-X', draft.method.toUpperCase(), shellQuote(draft.url)];

  for (const [name, value] of draftHeaderEntries(draft)) {
    parts.push('-H', shellQuote(`${name}: ${value}`));
  }

  if (draftHasBody(draft)) {
    parts.push('--data-raw', shellQuote(draft.body as string));
  }

  return parts.join(' ');
}

export function generateFetch(draft: ReplayDraft): string {
  const optionLines = [`  method: ${JSON.stringify(draft.method.toUpperCase())},`];
  const headers = draftHeaderEntries(draft);

  if (headers.length) {
    const headerObject = headers
      .map(([name, value]) => `    ${JSON.stringify(name)}: ${JSON.stringify(value)}`)
      .join(',\n');
    optionLines.push('  headers: {', headerObject, '  },');
  }

  if (draftHasBody(draft)) {
    optionLines.push(`  body: ${JSON.stringify(draft.body)},`);
  }

  const lastIndex = optionLines.length - 1;
  optionLines[lastIndex] = optionLines[lastIndex].replace(/,$/, '');

  return [`fetch(${JSON.stringify(draft.url)}, {`, ...optionLines, '});'].join('\n');
}
