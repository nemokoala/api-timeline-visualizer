import { readJson, writeJson } from './localStoragePrefs';

/** JSON 뷰어의 표시 옵션(들여쓰기 가이드선·무지개색). 모든 뷰어 인스턴스가 공유한다. */
export type JsonViewPrefs = {
  indentGuide: boolean;
  rainbow: boolean;
};

const STORAGE_KEY = 'api-flow-json-view-prefs';

// 기본값은 현재 화면과 동일한 모습(가이드선 표시 + 무지개색)이어야 한다.
const DEFAULT_PREFS: JsonViewPrefs = { indentGuide: true, rainbow: true };

// 저장된 값이 없거나 깨졌을 때도 항상 유효한 형태로 되돌린다.
function normalize(raw: unknown): JsonViewPrefs {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    indentGuide:
      typeof source.indentGuide === 'boolean' ? source.indentGuide : DEFAULT_PREFS.indentGuide,
    rainbow: typeof source.rainbow === 'boolean' ? source.rainbow : DEFAULT_PREFS.rainbow,
  };
}

// 모든 뷰어가 참조하는 단일 진실. 저장 시에만 참조가 바뀌어 useSyncExternalStore 스냅샷이 안정적이다.
let current: JsonViewPrefs = normalize(readJson<Partial<JsonViewPrefs>>(STORAGE_KEY));
const listeners = new Set<() => void>();

export function getJsonViewPrefs(): JsonViewPrefs {
  return current;
}

export function saveJsonViewPrefs(next: JsonViewPrefs): void {
  current = normalize(next);
  writeJson(STORAGE_KEY, current);
  listeners.forEach((listener) => listener());
}

export function subscribeJsonViewPrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
