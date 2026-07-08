/**
 * 네트워크 요청의 상태코드·메서드 구조화 필터.
 *
 * Include/Exclude 텍스트 필터(노이즈 제거)와 별개로, 상태 그룹(2xx~5xx/Err)과
 * HTTP 메서드로 행을 거른다. 둘 다 다중 선택이며 localStorage에 저장한다.
 * 빈 배열은 "모두 끔"으로 존중한다(리소스 타입 필터와 동일한 규칙).
 */
import type { ApiRequest } from '../types/network';
import { readJson, writeJson } from './localStoragePrefs';

export const STATUS_GROUPS = ['2xx', '3xx', '4xx', '5xx', 'error'] as const;

export type StatusGroup = (typeof STATUS_GROUPS)[number];

export const STATUS_GROUP_LABELS: Record<StatusGroup, string> = {
  '2xx': '2xx',
  '3xx': '3xx',
  '4xx': '4xx',
  '5xx': '5xx',
  error: 'Error',
};

export const FILTERABLE_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
  'OTHER',
] as const;

export type FilterableMethod = (typeof FILTERABLE_METHODS)[number];

const STATUS_GROUPS_KEY = 'api-flow-network-status-groups';
const METHODS_KEY = 'api-flow-network-methods';

function readEnabledList<T extends string>(key: string, allowed: readonly T[]): T[] {
  const stored = readJson<unknown>(key);
  // 저장된 값이 없으면(첫 실행) 전체 활성, 빈 배열이면 "모두 끔"으로 존중한다.
  if (!Array.isArray(stored)) return [...allowed];
  return allowed.filter((value) => stored.includes(value));
}

export function getEnabledStatusGroups(): StatusGroup[] {
  return readEnabledList(STATUS_GROUPS_KEY, STATUS_GROUPS);
}

export function saveEnabledStatusGroups(groups: StatusGroup[]): void {
  writeJson(STATUS_GROUPS_KEY, groups);
}

export function getEnabledMethods(): FilterableMethod[] {
  return readEnabledList(METHODS_KEY, FILTERABLE_METHODS);
}

export function saveEnabledMethods(methods: FilterableMethod[]): void {
  writeJson(METHODS_KEY, methods);
}

/** 요청 메서드를 필터 항목으로 정규화한다(목록에 없는 메서드는 OTHER). */
export function toFilterableMethod(method: string): FilterableMethod {
  const upper = method.toUpperCase();
  return (FILTERABLE_METHODS as readonly string[]).includes(upper)
    ? (upper as FilterableMethod)
    : 'OTHER';
}

/** 요청을 상태 그룹으로 분류한다. 어느 그룹에도 안 들면(1xx 등) null. */
export function toStatusGroup(request: ApiRequest): StatusGroup | null {
  if (request.status === 0 || request.error) return 'error';
  const bucket = Math.floor(request.status / 100);
  if (bucket === 2) return '2xx';
  if (bucket === 3) return '3xx';
  if (bucket === 4) return '4xx';
  if (bucket === 5) return '5xx';
  return null;
}

export function matchesStatusFilter(
  request: ApiRequest,
  enabledGroups: StatusGroup[],
): boolean {
  // 전체 활성이면 그룹 밖 상태(1xx 등)도 통과시킨다.
  if (enabledGroups.length === STATUS_GROUPS.length) return true;
  const group = toStatusGroup(request);
  return group !== null && enabledGroups.includes(group);
}

export function matchesMethodFilter(
  request: ApiRequest,
  enabledMethods: FilterableMethod[],
): boolean {
  if (enabledMethods.length === FILTERABLE_METHODS.length) return true;
  return enabledMethods.includes(toFilterableMethod(request.method));
}
