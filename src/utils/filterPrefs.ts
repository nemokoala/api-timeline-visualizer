/**
 * 네트워크 및 스토리지 패널의 포함/제외 필터 텍스트를 저장합니다.
 *
 * 네트워크 필터는 network/storage 분리 이전에 설정한 사용자를 위해
 * 레거시 키(분리 전 공용 키)로 폴백합니다.
 */
import { readString, writeString } from './localStoragePrefs';

// 분리 전 키 — network + storage 공용으로 사용됐으며, 현재는 폴백 읽기 전용.
const LEGACY_INCLUDE_TEXT_KEY = 'api-flow-filter-include';
const LEGACY_EXCLUDE_TEXT_KEY = 'api-flow-filter-exclude';

const NETWORK_INCLUDE_TEXT_KEY = 'api-flow-filter-network-include';
const NETWORK_EXCLUDE_TEXT_KEY = 'api-flow-filter-network-exclude';
const STORAGE_INCLUDE_TEXT_KEY = 'api-flow-filter-storage-include';
const STORAGE_EXCLUDE_TEXT_KEY = 'api-flow-filter-storage-exclude';

export const DEFAULT_NETWORK_INCLUDE_TEXT = 'api';
export const DEFAULT_NETWORK_EXCLUDE_TEXT =
  'google-analytics,sentry,datadog,amplitude,hotjar,segment';
export const DEFAULT_STORAGE_INCLUDE_TEXT = '';
export const DEFAULT_STORAGE_EXCLUDE_TEXT =
  'google-analytics,sentry,datadog,amplitude,hotjar,segment';

// 현재 키 우선 → 레거시 키 폴백 → 기본값 순으로 반환.
function readStoredText(key: string, legacyKey: string | null, defaultValue: string): string {
  const stored = readString(key);
  if (stored !== null) return stored;

  if (legacyKey) {
    const legacy = readString(legacyKey);
    if (legacy !== null) return legacy;
  }

  return defaultValue;
}

function saveStoredText(key: string, value: string): void {
  writeString(key, value);
}

export function getNetworkIncludeText(defaultValue = DEFAULT_NETWORK_INCLUDE_TEXT): string {
  return readStoredText(NETWORK_INCLUDE_TEXT_KEY, LEGACY_INCLUDE_TEXT_KEY, defaultValue);
}

export function getNetworkExcludeText(defaultValue = DEFAULT_NETWORK_EXCLUDE_TEXT): string {
  return readStoredText(NETWORK_EXCLUDE_TEXT_KEY, LEGACY_EXCLUDE_TEXT_KEY, defaultValue);
}

export function getStorageIncludeText(defaultValue = DEFAULT_STORAGE_INCLUDE_TEXT): string {
  return readStoredText(STORAGE_INCLUDE_TEXT_KEY, null, defaultValue);
}

export function getStorageExcludeText(defaultValue = DEFAULT_STORAGE_EXCLUDE_TEXT): string {
  return readStoredText(STORAGE_EXCLUDE_TEXT_KEY, null, defaultValue);
}

export function saveNetworkIncludeText(value: string): void {
  saveStoredText(NETWORK_INCLUDE_TEXT_KEY, value);
}

export function saveNetworkExcludeText(value: string): void {
  saveStoredText(NETWORK_EXCLUDE_TEXT_KEY, value);
}

export function saveStorageIncludeText(value: string): void {
  saveStoredText(STORAGE_INCLUDE_TEXT_KEY, value);
}

export function saveStorageExcludeText(value: string): void {
  saveStoredText(STORAGE_EXCLUDE_TEXT_KEY, value);
}
