import type { ApiRequest } from '../types/network';

const SKIP_HEADERS = new Set(['host', 'connection', 'content-length', 'accept-encoding']);

function shouldIncludeHeader(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower.startsWith(':')) return false;
  return !SKIP_HEADERS.has(lower);
}

function getRequestHeaders(request: ApiRequest): Array<[string, string]> {
  return Object.entries(request.requestHeaders ?? {}).filter(([name]) => shouldIncludeHeader(name));
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function formatRequestBodyLiteral(body: unknown): string | null {
  if (body === undefined || body === null) return null;
  if (typeof body === 'string') return body;
  if (typeof body === 'object') return JSON.stringify(body);
  return String(body);
}

function hasRequestBody(request: ApiRequest): boolean {
  return (
    formatRequestBodyLiteral(request.requestBody) !== null &&
    request.method !== 'GET' &&
    request.method !== 'HEAD'
  );
}

export function generateCurl(request: ApiRequest): string {
  const parts = ['curl', '-X', request.method, shellQuote(request.url)];

  for (const [name, value] of getRequestHeaders(request)) {
    parts.push('-H', shellQuote(`${name}: ${value}`));
  }

  const body = formatRequestBodyLiteral(request.requestBody);
  if (body !== null && hasRequestBody(request)) {
    parts.push('--data-raw', shellQuote(body));
  }

  return parts.join(' ');
}

export function generateFetch(request: ApiRequest): string {
  const optionLines = [`  method: ${JSON.stringify(request.method)},`];
  const headers = getRequestHeaders(request);

  if (headers.length) {
    const headerObject = headers
      .map(([name, value]) => `    ${JSON.stringify(name)}: ${JSON.stringify(value)}`)
      .join(',\n');
    optionLines.push('  headers: {', headerObject, '  },');
  }

  const body = formatRequestBodyLiteral(request.requestBody);
  if (body !== null && hasRequestBody(request)) {
    optionLines.push(`  body: ${JSON.stringify(body)},`);
  }

  const lastIndex = optionLines.length - 1;
  optionLines[lastIndex] = optionLines[lastIndex].replace(/,$/, '');

  return [`fetch(${JSON.stringify(request.url)}, {`, ...optionLines, '});'].join('\n');
}
