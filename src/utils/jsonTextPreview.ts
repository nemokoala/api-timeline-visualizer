/**
 * 표 한 행에 들어갈 만큼 JSON 텍스트를 줄인다. 콘솔 메시지 셀과 스토리지 값 셀이 함께 쓴다.
 *
 * 텍스트 전체가 JSON이면 통째로 요약하고, 평문 사이에 낀 JSON 구간만 있으면
 * 그 구간만 요약한다(`App booted { env: "development", … +2 keys }`).
 */
const MAX_JSON_CHARS = 120;
const MAX_OBJECT_KEYS = 4;
const MAX_ARRAY_ITEMS = 3;
const MAX_STRING_PREVIEW = 48;

export function formatJsonTextPreview(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return text;

  const whole = tryParseJson(trimmed);
  if (whole !== undefined) {
    return trimmed.length > MAX_JSON_CHARS ? summarizeJson(whole) : text;
  }

  return replaceLongJsonSegments(text);
}

function replaceLongJsonSegments(text: string): string {
  let result = '';
  let index = 0;

  while (index < text.length) {
    const char = text[index];
    if (char !== '{' && char !== '[') {
      result += char;
      index += 1;
      continue;
    }

    const end = findJsonEnd(text, index);
    if (end === null) {
      result += char;
      index += 1;
      continue;
    }

    const segment = text.slice(index, end);
    const parsed = tryParseJson(segment);
    if (parsed !== undefined && segment.length > MAX_JSON_CHARS) {
      result += summarizeJson(parsed);
      index = end;
      continue;
    }

    result += char;
    index += 1;
  }

  return result;
}

function findJsonEnd(text: string, start: number): number | null {
  const open = text[start];
  if (open !== '{' && open !== '[') return null;

  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }

  return null;
}

function tryParseJson(value: string): unknown | undefined {
  const trimmed = value.trim();
  if (
    !(
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    )
  ) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

function summarizeJson(value: unknown, depth = 0): string {
  if (depth > 2) return '…';

  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => summarizeJson(item, depth + 1));
    const remaining = value.length - MAX_ARRAY_ITEMS;
    return remaining > 0 ? `[${items.join(', ')}, … +${remaining} more]` : `[${items.join(', ')}]`;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (record.__type === 'Error') {
      return `Error { ${String(record.message ?? 'unknown')} }`;
    }

    const entries = Object.entries(record);
    if (!entries.length) return '{}';

    const shown = entries.slice(0, MAX_OBJECT_KEYS);
    const parts = shown.map(([key, item]) => `${key}: ${summarizeJson(item, depth + 1)}`);
    const remaining = entries.length - MAX_OBJECT_KEYS;
    if (remaining > 0) parts.push(`… +${remaining} keys`);

    return `{ ${parts.join(', ')} }`;
  }

  return previewPrimitive(value);
}

function previewPrimitive(value: unknown): string {
  if (typeof value === 'string') {
    const compact = value.replace(/\s+/g, ' ');
    if (compact.length <= MAX_STRING_PREVIEW) return JSON.stringify(compact);
    return `${JSON.stringify(compact.slice(0, MAX_STRING_PREVIEW - 1))}…`;
  }

  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'bigint') return `${value.toString()}n`;
  return String(value);
}
