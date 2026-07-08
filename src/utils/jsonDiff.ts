/**
 * 두 JSON 값의 구조적 diff를 라인 목록으로 만든다(응답 비교 뷰어용).
 *
 * - 변경 없는 하위 트리는 한 줄 요약(`{ … }`)으로 접어 변경점에 집중한다.
 * - 객체는 키 단위로 비교(왼쪽 키 순서 우선, 오른쪽 추가 키는 뒤에).
 * - 배열은 인덱스 단위로 비교한다.
 * - 타입이 다르거나 원시값이 다르면 제거(-)/추가(+) 두 줄로 표시한다.
 */

export type DiffLineType = 'same' | 'added' | 'removed';

export type DiffLine = {
  type: DiffLineType;
  depth: number;
  text: string;
};

export type JsonDiffResult = {
  lines: DiffLine[];
  /** 추가/제거된 노드 수(변경 1건 = 제거+추가 각 1). */
  addedCount: number;
  removedCount: number;
};

const MAX_LINES = 4000;

export function buildJsonDiff(left: unknown, right: unknown): JsonDiffResult {
  const result: JsonDiffResult = { lines: [], addedCount: 0, removedCount: 0 };
  diffValue(null, left, right, 0, result);
  if (result.lines.length > MAX_LINES) {
    const omitted = result.lines.length - MAX_LINES;
    result.lines = result.lines.slice(0, MAX_LINES);
    result.lines.push({ type: 'same', depth: 0, text: `… ${omitted} more lines omitted` });
  }
  return result;
}

function diffValue(
  key: string | null,
  left: unknown,
  right: unknown,
  depth: number,
  result: JsonDiffResult,
): void {
  if (deepEqual(left, right)) {
    pushLine(result, 'same', depth, `${keyPrefix(key)}${previewValue(left)}`);
    return;
  }

  const bothObjects = isPlainObject(left) && isPlainObject(right);
  const bothArrays = Array.isArray(left) && Array.isArray(right);

  if (bothObjects) {
    pushLine(result, 'same', depth, `${keyPrefix(key)}{`);
    const leftObj = left as Record<string, unknown>;
    const rightObj = right as Record<string, unknown>;
    const keys = [
      ...Object.keys(leftObj),
      ...Object.keys(rightObj).filter((item) => !(item in leftObj)),
    ];
    for (const childKey of keys) {
      if (!(childKey in rightObj)) {
        emitSubtree(childKey, leftObj[childKey], 'removed', depth + 1, result);
      } else if (!(childKey in leftObj)) {
        emitSubtree(childKey, rightObj[childKey], 'added', depth + 1, result);
      } else {
        diffValue(childKey, leftObj[childKey], rightObj[childKey], depth + 1, result);
      }
    }
    pushLine(result, 'same', depth, '}');
    return;
  }

  if (bothArrays) {
    const leftArr = left as unknown[];
    const rightArr = right as unknown[];
    pushLine(result, 'same', depth, `${keyPrefix(key)}[`);
    const max = Math.max(leftArr.length, rightArr.length);
    for (let index = 0; index < max; index += 1) {
      if (index >= rightArr.length) {
        emitSubtree(String(index), leftArr[index], 'removed', depth + 1, result);
      } else if (index >= leftArr.length) {
        emitSubtree(String(index), rightArr[index], 'added', depth + 1, result);
      } else {
        diffValue(String(index), leftArr[index], rightArr[index], depth + 1, result);
      }
    }
    pushLine(result, 'same', depth, ']');
    return;
  }

  // 타입이 다르거나 원시값이 다른 경우: 제거 + 추가로 표시.
  emitSubtree(key, left, 'removed', depth, result);
  emitSubtree(key, right, 'added', depth, result);
}

/** 하위 트리 전체를 추가/제거 라인으로 펼친다. */
function emitSubtree(
  key: string | null,
  value: unknown,
  type: 'added' | 'removed',
  depth: number,
  result: JsonDiffResult,
): void {
  const serialized = safeStringify(value);
  const lines = serialized.split('\n');
  lines.forEach((line, index) => {
    pushLine(result, type, depth, index === 0 ? `${keyPrefix(key)}${line}` : line);
  });
  if (type === 'added') result.addedCount += 1;
  else result.removedCount += 1;
}

function pushLine(result: JsonDiffResult, type: DiffLineType, depth: number, text: string): void {
  if (result.lines.length > MAX_LINES + 50) return;
  result.lines.push({ type, depth, text });
}

function keyPrefix(key: string | null): string {
  return key === null ? '' : `${key}: `;
}

/** 변경 없는 값의 한 줄 요약. */
function previewValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.length ? `[ … ] (${value.length} items)` : '[]';
  }
  if (isPlainObject(value)) {
    const count = Object.keys(value as Record<string, unknown>).length;
    return count ? `{ … } (${count} keys)` : '{}';
  }
  return formatPrimitive(value);
}

function formatPrimitive(value: unknown): string {
  if (typeof value === 'string') {
    const compact = value.length > 120 ? `${value.slice(0, 120)}…` : value;
    return JSON.stringify(compact);
  }
  if (value === undefined) return 'undefined';
  return String(value);
}

function safeStringify(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return formatPrimitive(value);
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false;
    return left.every((item, index) => deepEqual(item, right[index]));
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every((key) => key in right && deepEqual(left[key], right[key]));
  }

  return false;
}
