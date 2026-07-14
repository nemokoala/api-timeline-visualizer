import type { MessageKey } from '../i18n';
import { readJson, writeJson } from './localStoragePrefs';

/** 들여쓰기 가이드선을 칠하는 방식. zebra는 두 톤을 번갈아 써 무지개보다 눈에 덜 띈다. */
export type JsonGuideColor = 'plain' | 'rainbow' | 'zebra';

/** 설정 창(세그먼트)과 뷰어 우클릭 메뉴가 같은 순서·라벨을 쓰도록 한곳에 둔다. */
export const GUIDE_COLOR_OPTIONS: Array<{ value: JsonGuideColor; labelKey: MessageKey }> = [
  { value: 'plain', labelKey: 'jsonViewer.guideColorPlain' },
  { value: 'rainbow', labelKey: 'jsonViewer.guideColorRainbow' },
  { value: 'zebra', labelKey: 'jsonViewer.guideColorZebra' },
];

const GUIDE_COLORS: JsonGuideColor[] = GUIDE_COLOR_OPTIONS.map((option) => option.value);

/** JSON 뷰어의 표시 옵션. 모든 뷰어 인스턴스가 공유한다. */
export type JsonViewPrefs = {
  indentGuide: boolean;
  guideColor: JsonGuideColor;
  /** 배열 여는 대괄호 옆에 요소 개수를 표시한다. */
  arrayLength: boolean;
};

const STORAGE_KEY = 'api-flow-json-view-prefs';

// 기본값은 기존 화면과 동일한 모습(가이드선 표시 + 무지개색)에 새 옵션을 더한 것이다.
const DEFAULT_PREFS: JsonViewPrefs = {
  indentGuide: true,
  guideColor: 'rainbow',
  arrayLength: true,
};

// 저장된 값이 없거나 깨졌을 때도 항상 유효한 형태로 되돌린다.
// guideColor는 예전 불리언 rainbow를 대체했다 — 이미 저장된 값이 있으면 그 뜻을 이어받는다.
function normalize(raw: unknown): JsonViewPrefs {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const legacyRainbow = typeof source.rainbow === 'boolean' ? source.rainbow : null;
  const guideColor = GUIDE_COLORS.includes(source.guideColor as JsonGuideColor)
    ? (source.guideColor as JsonGuideColor)
    : legacyRainbow != null
      ? legacyRainbow
        ? 'rainbow'
        : 'plain'
      : DEFAULT_PREFS.guideColor;

  return {
    indentGuide:
      typeof source.indentGuide === 'boolean' ? source.indentGuide : DEFAULT_PREFS.indentGuide,
    guideColor,
    arrayLength:
      typeof source.arrayLength === 'boolean' ? source.arrayLength : DEFAULT_PREFS.arrayLength,
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
