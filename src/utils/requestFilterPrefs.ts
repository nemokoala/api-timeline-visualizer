/**
 * 네트워크 요청의 상태코드·메서드 구조화 필터.
 *
 * Include/Exclude 텍스트 필터(노이즈 제거)와 별개로, 상태 그룹(2xx~5xx/Error)과
 * HTTP 메서드로 행을 거른다. 선택값은 localStorage에 저장한다.
 */
import type { ApiRequest } from '../types/network';
import { readEnum, readJson, writeJson, writeString } from './localStoragePrefs';

export type StatusFilter = 'all' | '2xx' | '3xx' | '4xx' | '5xx' | 'error';

export const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: '2xx', label: '2xx' },
  { value: '3xx', label: '3xx' },
  { value: '4xx', label: '4xx' },
  { value: '5xx', label: '5xx' },
  { value: 'error', label: 'Err' },
];

const STATUS_FILTER_VALUES = STATUS_FILTERS.map((filter) => filter.value);

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

const STATUS_FILTER_KEY = 'api-flow-network-status-filter';
const METHODS_KEY = 'api-flow-network-methods';

export function getStatusFilter(): StatusFilter {
  return readEnum<StatusFilter>(STATUS_FILTER_KEY, STATUS_FILTER_VALUES, 'all');
}

export function saveStatusFilter(filter: StatusFilter): void {
  writeString(STATUS_FILTER_KEY, filter);
}

export function getEnabledMethods(): FilterableMethod[] {
  const stored = readJson<unknown>(METHODS_KEY);
  if (!Array.isArray(stored)) return [...FILTERABLE_METHODS];
  const valid = FILTERABLE_METHODS.filter((method) => stored.includes(method));
  // 전부 꺼진 값이 저장돼 있으면 빈 화면이 되므로 전체 활성으로 폴백.
  return valid.length ? valid : [...FILTERABLE_METHODS];
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

export function matchesStatusFilter(request: ApiRequest, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'error') return request.status === 0 || Boolean(request.error);
  const bucket = Math.floor(request.status / 100);
  if (filter === '2xx') return bucket === 2;
  if (filter === '3xx') return bucket === 3;
  if (filter === '4xx') return bucket === 4;
  return bucket === 5;
}

export function matchesMethodFilter(
  request: ApiRequest,
  enabledMethods: FilterableMethod[],
): boolean {
  if (enabledMethods.length === FILTERABLE_METHODS.length) return true;
  return enabledMethods.includes(toFilterableMethod(request.method));
}
