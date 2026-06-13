/**
 * 요청 상세 패널에서 각 접이식 섹션의 펼침 상태를 저장합니다.
 * `{ [sectionId]: open }` 형태로 보관하며, 알 수 없는 섹션은
 * DEFAULT_OPEN → 호출자 제공 fallback 순으로 적용합니다.
 */
import { readJson, writeJson } from './localStoragePrefs';

const STORAGE_KEY = 'api-flow-detail-sections';

// 알려진 섹션 ID별 기본 펼침/접힘 상태.
const DEFAULT_OPEN: Record<string, boolean> = {
  general: true,
  headers: false,
  payload: false,
  response: true,
  timing: false,
  replay: false,
};

function readPrefs(): Record<string, boolean> {
  return readJson<Record<string, boolean>>(STORAGE_KEY) ?? {};
}

function writePrefs(prefs: Record<string, boolean>): void {
  writeJson(STORAGE_KEY, prefs);
}

export function getDetailSectionOpen(sectionId: string, fallback = false): boolean {
  const prefs = readPrefs();
  if (typeof prefs[sectionId] === 'boolean') return prefs[sectionId];
  return DEFAULT_OPEN[sectionId] ?? fallback;
}

export function setDetailSectionOpen(sectionId: string, open: boolean): void {
  const prefs = readPrefs();
  prefs[sectionId] = open;
  writePrefs(prefs);
}
