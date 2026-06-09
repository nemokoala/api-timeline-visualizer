export type StorageImageLayoutMode = 'stack' | 'grid';

const STORAGE_IMAGE_LAYOUT_KEY = 'api-flow-storage-image-layout';

export function getStorageImageLayoutMode(): StorageImageLayoutMode {
  try {
    const stored = localStorage.getItem(STORAGE_IMAGE_LAYOUT_KEY);
    if (stored === 'grid' || stored === 'stack') return stored;
  } catch {
    // Ignore storage errors.
  }

  return 'stack';
}

export function saveStorageImageLayoutMode(mode: StorageImageLayoutMode): void {
  try {
    localStorage.setItem(STORAGE_IMAGE_LAYOUT_KEY, mode);
  } catch {
    // Ignore storage errors.
  }
}
