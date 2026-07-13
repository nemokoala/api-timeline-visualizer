/** 스토리지 패널의 이미지 blob 레이아웃(stack / grid)과 그리드 타일 크기를 저장합니다. */
import { readEnum, readNumber, writeNumber, writeString } from './localStoragePrefs';

export type StorageImageLayoutMode = 'stack' | 'grid';

const STORAGE_IMAGE_LAYOUT_KEY = 'api-flow-storage-image-layout';
const STORAGE_IMAGE_GRID_SIZE_KEY = 'api-flow-storage-image-grid-size';

const LAYOUT_MODES: StorageImageLayoutMode[] = ['stack', 'grid'];

/** 그리드 타일의 최소 폭(px). 열 개수는 이 값과 패널 폭에 따라 auto-fill로 정해진다. */
export const GRID_SIZE_MIN = 72;
export const GRID_SIZE_MAX = 320;
export const GRID_SIZE_DEFAULT = 104;

export function getStorageImageLayoutMode(): StorageImageLayoutMode {
  return readEnum(STORAGE_IMAGE_LAYOUT_KEY, LAYOUT_MODES, 'stack');
}

export function saveStorageImageLayoutMode(mode: StorageImageLayoutMode): void {
  writeString(STORAGE_IMAGE_LAYOUT_KEY, mode);
}

export function getStorageImageGridSize(): number {
  return clampGridSize(readNumber(STORAGE_IMAGE_GRID_SIZE_KEY, GRID_SIZE_DEFAULT));
}

export function saveStorageImageGridSize(size: number): void {
  writeNumber(STORAGE_IMAGE_GRID_SIZE_KEY, clampGridSize(size));
}

// 저장된 값이 깨졌거나 범위를 벗어나도 항상 쓸 만한 크기로 되돌린다.
function clampGridSize(size: number): number {
  if (!Number.isFinite(size)) return GRID_SIZE_DEFAULT;
  return Math.min(GRID_SIZE_MAX, Math.max(GRID_SIZE_MIN, Math.round(size)));
}
