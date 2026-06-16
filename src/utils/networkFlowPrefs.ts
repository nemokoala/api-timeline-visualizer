/**
 * 네트워크 뷰 설정: 플로우 노드의 시간 기준 그룹화 여부,
 * 그리고 네트워크 워크스페이스가 플로우 그래프와 타임라인 중 어떤 방식으로 표시될지를 저장합니다.
 */
import { readEnum, readFlag, writeFlag, writeString } from './localStoragePrefs';

const GROUP_FLOW_BY_TIME_KEY = 'api-flow-group-flow-by-time';
const NETWORK_VIEW_MODE_KEY = 'api-flow-network-view-mode';
const FLOW_SHOW_QUERY_KEY = 'api-flow-show-query';

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
