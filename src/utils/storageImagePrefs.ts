/** 스토리지 패널의 이미지 blob 레이아웃(stack / grid)을 저장합니다. */
import { readEnum, writeString } from './localStoragePrefs';

export type StorageImageLayoutMode = 'stack' | 'grid';

const STORAGE_IMAGE_LAYOUT_KEY = 'api-flow-storage-image-layout';

const LAYOUT_MODES: StorageImageLayoutMode[] = ['stack', 'grid'];

export function getStorageImageLayoutMode(): StorageImageLayoutMode {
  return readEnum(STORAGE_IMAGE_LAYOUT_KEY, LAYOUT_MODES, 'stack');
}

export function saveStorageImageLayoutMode(mode: StorageImageLayoutMode): void {
  writeString(STORAGE_IMAGE_LAYOUT_KEY, mode);
}
