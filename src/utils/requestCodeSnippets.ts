import type { ApiRequest } from '../types/network';

const SKIP_HEADERS = new Set(['host', 'connection', 'content-length', 'accept-encoding']);

function shouldIncludeHeader(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower.startsWith(':')) return false;
  return !SKIP_HEADERS.has(lower);
}

/** 재현(cURL/fetch/재전송)에 포함할 요청 헤더 목록. 의사 헤더·전송 관련 헤더는 제외. */
export function getReplayHeaders(request: ApiRequest): Array<[string, string]> {
  return Object.entries(request.requestHeaders ?? {}).filter(([name]) => shouldIncludeHeader(name));
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

/** 재현 시 요청 본문을 포함해야 하는지(GET/HEAD 제외). */
export function hasReplayBody(request: ApiRequest): boolean {
  return (
    formatRequestBodyLiteral(request.requestBody) !== null &&
    request.method !== 'GET' &&
    request.method !== 'HEAD'
  );
}

export function generateCurl(request: ApiRequest): string {
  const parts = ['curl', '-X', request.method, shellQuote(request.url)];

  for (const [name, value] of getReplayHeaders(request)) {
    parts.push('-H', shellQuote(`${name}: ${value}`));
  }

  const body = formatRequestBodyLiteral(request.requestBody);
  if (body !== null && hasReplayBody(request)) {
    parts.push('--data-raw', shellQuote(body));
  }

  return parts.join(' ');
}

export function generateFetch(request: ApiRequest): string {
  const optionLines = [`  method: ${JSON.stringify(request.method)},`];
  const headers = getReplayHeaders(request);

  if (headers.length) {
    const headerObject = headers
      .map(([name, value]) => `    ${JSON.stringify(name)}: ${JSON.stringify(value)}`)
      .join(',\n');
    optionLines.push('  headers: {', headerObject, '  },');
  }

  const body = formatRequestBodyLiteral(request.requestBody);
  if (body !== null && hasReplayBody(request)) {
    optionLines.push(`  body: ${JSON.stringify(body)},`);
  }

  const lastIndex = optionLines.length - 1;
  optionLines[lastIndex] = optionLines[lastIndex].replace(/,$/, '');

  return [`fetch(${JSON.stringify(request.url)}, {`, ...optionLines, '});'].join('\n');
}
