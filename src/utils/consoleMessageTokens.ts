/**
 * 콘솔 행의 한 줄 미리보기 문자열을 구문 색상용 토큰으로 쪼갠다.
 *
 * 미리보기는 진짜 JSON이 아니다. `formatConsoleMessagePreview`가 만드는 요약형
 * (`{ env: "development", … +2 keys }`)과 원본 텍스트(`{"env":"development"}`)가
 * 섞여 들어오고, 앞뒤로 평문이 붙는다(`App booted { … }`). 그래서 파서가 아니라
 * 스캐너로 처리한다 — 중괄호/대괄호로 열리고 닫히는 구간만 JSON으로 보고,
 * 그 안에서만 키·문자열·숫자를 구분한다.
 *
 * 토큰은 항상 원본 문자열을 왼쪽에서 오른쪽으로 빠짐없이 덮는다. 호출부가
 * 토큰마다 검색 하이라이트를 그려도 `.search-highlight` 마크의 DOM 순서가
 * 원본과 같아야 하기 때문이다(consoleSearch의 occurrenceIndex가 순번에 의존).
 */
export type ConsoleMessageTokenKind =
  | 'plain'
  | 'key'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'punct';

export type ConsoleMessageToken = {
  text: string;
  kind: ConsoleMessageTokenKind;
  /** 몇 번째 JSON 구간에 속하는지. 구간 밖의 평문은 null. */
  segmentIndex: number | null;
};

export function tokenizeConsoleMessage(text: string): ConsoleMessageToken[] {
  const tokens: ConsoleMessageToken[] = [];
  let index = 0;
  let plain = '';
  let segmentIndex = 0;

  const flushPlain = () => {
    if (!plain) return;
    tokens.push({ text: plain, kind: 'plain', segmentIndex: null });
    plain = '';
  };

  while (index < text.length) {
    const char = text[index];
    if (char !== '{' && char !== '[') {
      plain += char;
      index += 1;
      continue;
    }

    const end = findSegmentEnd(text, index);
    const segment = end === null ? null : text.slice(index, end);
    // `[table] 2 rows`처럼 괄호만 있는 평문은 JSON으로 보지 않는다.
    if (end === null || segment === null || !/[:"]/.test(segment)) {
      plain += char;
      index += 1;
      continue;
    }

    flushPlain();
    tokens.push(...tokenizeSegment(segment, segmentIndex));
    segmentIndex += 1;
    index = end;
  }

  flushPlain();
  return mergeAdjacent(tokens);
}

/**
 * 토큰을 렌더 줄 단위로 묶는다. 평문 뒤에 JSON 구간이 오면 새 줄로 내린다
 * (`App booted` / `{ env: … }`). 메시지 전체가 JSON이면 줄을 나누지 않는다.
 */
export function groupConsoleMessageLines(tokens: ConsoleMessageToken[]): ConsoleMessageToken[][] {
  const lines: ConsoleMessageToken[][] = [];
  let previousSegment: number | null = null;

  for (const token of tokens) {
    const startsNewSegment = token.segmentIndex !== null && token.segmentIndex !== previousSegment;
    // 앞에 내용이 있어야 줄을 나눈다 — 첫 줄부터 비우지 않는다.
    if ((startsNewSegment && lines.length > 0) || lines.length === 0) {
      lines.push([]);
    }
    lines[lines.length - 1].push(token);
    previousSegment = token.segmentIndex;
  }

  return lines;
}

/** 짝이 맞는 닫는 괄호의 다음 인덱스. 못 찾으면 null. */
function findSegmentEnd(text: string, start: number): number | null {
  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
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

const PUNCT = new Set(['{', '}', '[', ']', ',', ':']);
const IDENT_START = /[A-Za-z_$]/;
const IDENT_BODY = /[\w$]/;

function tokenizeSegment(segment: string, segmentIndex: number): ConsoleMessageToken[] {
  const tokens: ConsoleMessageToken[] = [];
  let index = 0;

  while (index < segment.length) {
    const char = segment[index];

    if (char === '"') {
      const end = readStringEnd(segment, index);
      // 뒤에 콜론이 오면 키다: {"env": "development"}
      tokens.push({
        text: segment.slice(index, end),
        kind: nextNonSpace(segment, end) === ':' ? 'key' : 'string',
        segmentIndex,
      });
      index = end;
      continue;
    }

    if (char === '-' || (char >= '0' && char <= '9')) {
      const end = readNumberEnd(segment, index);
      tokens.push({ text: segment.slice(index, end), kind: 'number', segmentIndex });
      index = end;
      continue;
    }

    if (IDENT_START.test(char)) {
      let end = index + 1;
      while (end < segment.length && IDENT_BODY.test(segment[end])) end += 1;
      const text = segment.slice(index, end);
      tokens.push({ text, kind: identifierKind(text, nextNonSpace(segment, end)), segmentIndex });
      index = end;
      continue;
    }

    tokens.push({ text: char, kind: PUNCT.has(char) ? 'punct' : 'plain', segmentIndex });
    index += 1;
  }

  return tokens;
}

function identifierKind(text: string, next: string | null): ConsoleMessageTokenKind {
  // 요약형은 키를 따옴표 없이 쓴다: { env: "development" }
  if (next === ':') return 'key';
  if (text === 'true' || text === 'false') return 'boolean';
  if (text === 'null' || text === 'undefined') return 'null';
  return 'plain';
}

function readStringEnd(segment: string, start: number): number {
  let escaped = false;
  for (let index = start + 1; index < segment.length; index += 1) {
    const char = segment[index];
    if (escaped) escaped = false;
    else if (char === '\\') escaped = true;
    else if (char === '"') return index + 1;
  }
  return segment.length;
}

function readNumberEnd(segment: string, start: number): number {
  let index = start + 1;
  while (index < segment.length && /[\d.eE+-]/.test(segment[index])) index += 1;
  return index;
}

function nextNonSpace(segment: string, from: number): string | null {
  for (let index = from; index < segment.length; index += 1) {
    if (!/\s/.test(segment[index])) return segment[index];
  }
  return null;
}

/** 같은 종류가 연달아 나오면 합쳐 span 수를 줄인다. */
function mergeAdjacent(tokens: ConsoleMessageToken[]): ConsoleMessageToken[] {
  const merged: ConsoleMessageToken[] = [];
  for (const token of tokens) {
    const previous = merged[merged.length - 1];
    if (previous && previous.kind === token.kind && previous.segmentIndex === token.segmentIndex) {
      previous.text += token.text;
      continue;
    }
    merged.push({ ...token });
  }
  return merged;
}
