/** 네트워크 요약 패널의 펼침/접힘 상태를 저장한다. */
import { readFlag, writeFlag } from './localStoragePrefs';

const SUMMARY_OPEN_KEY = 'api-flow-network-summary-open';

export function getNetworkSummaryOpen(defaultValue = false): boolean {
  return readFlag(SUMMARY_OPEN_KEY, defaultValue);
}

export function saveNetworkSummaryOpen(value: boolean): void {
  writeFlag(SUMMARY_OPEN_KEY, value);
}
