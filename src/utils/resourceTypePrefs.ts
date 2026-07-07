/**
 * 네트워크 뷰의 리소스 타입 필터 설정.
 *
 * 종류별(Fetch/XHR/Doc/WS/CSS/JS/Img/Font/Media)로 표시 여부를 켜고 끌 수 있다.
 * 기본값은 API 계열(fetch/xhr/document/websocket)만 켜져 기존 동작과 동일하고,
 * 정적 리소스(css/js/이미지/폰트/미디어)는 꺼져 있다. 여기에는 "켜진 종류 집합"을 저장한다.
 * 목록에 없는 종류('other' 등)는 토글 대상이 아니며 항상 표시한다.
 */
import type { RequestKind } from '../types/network';
import { readJson, writeJson } from './localStoragePrefs';

// 이전 버전(정적 리소스만 저장하던 모델)과 의미가 달라졌으므로 키를 새로 쓴다.
const RESOURCE_TYPE_FILTER_KEY = 'api-flow-visible-resource-kinds';

/** 사용자가 토글로 켜고 끌 수 있는 리소스 종류. */
export const TOGGLEABLE_RESOURCE_KINDS = [
  'fetch',
  'xhr',
  'document',
  'websocket',
  'stylesheet',
  'script',
  'image',
  'font',
  'media',
] as const;
export type ToggleableResourceKind = (typeof TOGGLEABLE_RESOURCE_KINDS)[number];

// 저장된 설정이 없을 때의 기본값(기존 동작): API 계열만 표시.
const DEFAULT_ENABLED_KINDS: ToggleableResourceKind[] = ['fetch', 'xhr', 'document', 'websocket'];

const TOGGLEABLE_SET = new Set<RequestKind>(TOGGLEABLE_RESOURCE_KINDS);

/** 토글 대상 종류인지 여부. 아니면('other' 등) 항상 표시된다. */
export function isToggleableResourceKind(kind: RequestKind): kind is ToggleableResourceKind {
  return TOGGLEABLE_SET.has(kind);
}

export function getEnabledResourceKinds(): ToggleableResourceKind[] {
  const stored = readJson<string[]>(RESOURCE_TYPE_FILTER_KEY);
  // 저장된 값이 없으면(첫 실행) 기본값을 쓰고, 빈 배열이면 "모두 끔"으로 존중한다.
  if (!Array.isArray(stored)) return [...DEFAULT_ENABLED_KINDS];
  return TOGGLEABLE_RESOURCE_KINDS.filter((kind) => stored.includes(kind));
}

export function saveEnabledResourceKinds(kinds: ToggleableResourceKind[]): void {
  writeJson(RESOURCE_TYPE_FILTER_KEY, kinds);
}
