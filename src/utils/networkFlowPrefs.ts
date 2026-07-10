/**
 * 네트워크 뷰 설정: 플로우 노드의 시간 기준 그룹화 여부,
 * 그리고 네트워크 워크스페이스가 플로우 그래프와 타임라인 중 어떤 방식으로 표시될지를 저장합니다.
 */
import { readEnum, readFlag, writeFlag, writeString } from './localStoragePrefs';

const GROUP_FLOW_BY_TIME_KEY = 'api-flow-group-flow-by-time';
const NETWORK_VIEW_MODE_KEY = 'api-flow-network-view-mode';
const FLOW_SHOW_QUERY_KEY = 'api-flow-show-query';
const COLLAPSE_PATH_IDS_KEY = 'api-flow-collapse-path-ids';
const CLEAR_NETWORK_ON_RELOAD_KEY = 'api-flow-clear-network-on-reload';

export type NetworkViewMode = 'flow' | 'timeline';

const NETWORK_VIEW_MODES: NetworkViewMode[] = ['flow', 'timeline'];

export function getGroupFlowByTime(defaultValue = true): boolean {
  return readFlag(GROUP_FLOW_BY_TIME_KEY, defaultValue);
}

export function saveGroupFlowByTime(value: boolean): void {
  writeFlag(GROUP_FLOW_BY_TIME_KEY, value);
}

export function getNetworkViewMode(defaultValue: NetworkViewMode = 'timeline'): NetworkViewMode {
  return readEnum(NETWORK_VIEW_MODE_KEY, NETWORK_VIEW_MODES, defaultValue);
}

export function saveNetworkViewMode(value: NetworkViewMode): void {
  writeString(NETWORK_VIEW_MODE_KEY, value);
}

/** 플로우 카드 타이틀에 쿼리 문자열을 표시할지 여부. */
export function getFlowShowQuery(defaultValue = false): boolean {
  return readFlag(FLOW_SHOW_QUERY_KEY, defaultValue);
}

export function saveFlowShowQuery(value: boolean): void {
  writeFlag(FLOW_SHOW_QUERY_KEY, value);
}

/**
 * 경로의 ID·날짜·해시를 `:id` 등으로 접어 보여줄지 여부. 기본은 꺼짐(실제 값 표시).
 * 표시에만 영향을 주고, 같은 엔드포인트 묶음 판정 등 로직은 언제나 정규화 값을 쓴다.
 */
export function getCollapsePathIds(defaultValue = false): boolean {
  return readFlag(COLLAPSE_PATH_IDS_KEY, defaultValue);
}

export function saveCollapsePathIds(value: boolean): void {
  writeFlag(COLLAPSE_PATH_IDS_KEY, value);
}

/** 검사 중인 페이지가 새로고침·이동될 때 캡처한 네트워크 기록을 자동으로 지울지 여부. 기본은 꺼짐. */
export function getClearNetworkOnReload(defaultValue = false): boolean {
  return readFlag(CLEAR_NETWORK_ON_RELOAD_KEY, defaultValue);
}

export function saveClearNetworkOnReload(value: boolean): void {
  writeFlag(CLEAR_NETWORK_ON_RELOAD_KEY, value);
}
