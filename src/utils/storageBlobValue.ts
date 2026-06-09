import { formatMaxImageBlobLimit } from './storageLimits';

type StorageBlobMarker = {
  __apiFlowImageBlob?: true;
  __apiFlowBlob?: true;
  mimeType?: string;
  size?: number;
  dataUrl?: string;
};

export function parseStorageBlobMarker(value: string): StorageBlobMarker | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith('{')) return null;

  try {
    const parsed = JSON.parse(trimmed) as StorageBlobMarker;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.__apiFlowImageBlob || parsed.__apiFlowBlob) return parsed;
  } catch {
    return null;
  }

  return null;
}

export function formatStorageValuePreview(value: string, formatBytes: (bytes: number) => string): string {
  const marker = parseStorageBlobMarker(value);
  if (!marker) return value;

  const mimeType = marker.mimeType || (marker.__apiFlowImageBlob ? 'image/*' : 'application/octet-stream');
  const sizeLabel = typeof marker.size === 'number' ? formatBytes(marker.size) : '?';

  if (marker.__apiFlowImageBlob) {
    return `[Image Blob: ${mimeType}, ${sizeLabel}]`;
  }

  return `[Blob: ${mimeType}, ${sizeLabel}]`;
}

export function sanitizeStorageBlobsForDisplay(value: unknown): unknown {
  if (typeof value === 'string') {
    const marker = parseStorageBlobMarker(value);
    if (marker) return redactStorageBlobMarker(marker);
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeStorageBlobsForDisplay(item));
  }

  if (!value || typeof value !== 'object') return value;

  const record = value as Record<string, unknown>;
  if (record.__apiFlowImageBlob || record.__apiFlowBlob) {
    return redactStorageBlobMarker(record as StorageBlobMarker);
  }

  return Object.fromEntries(
    Object.entries(record).map(([key, item]) => [key, sanitizeStorageBlobsForDisplay(item)]),
  );
}

function redactStorageBlobMarker(marker: StorageBlobMarker): StorageBlobMarker {
  const sizeLabel = typeof marker.size === 'number' ? `${marker.size} bytes` : 'unknown size';

  if (marker.__apiFlowImageBlob) {
    return {
      __apiFlowImageBlob: true,
      mimeType: marker.mimeType,
      size: marker.size,
      dataUrl: `[base64 image data, ${sizeLabel}]`,
    };
  }

  return {
    __apiFlowBlob: true,
    mimeType: marker.mimeType,
    size: marker.size,
  };
}

export type StorageBlobPreviewItem = {
  blobKeyPath: string;
  mimeType: string;
  size?: number;
  src?: string;
  unavailableReason?: string;
};

export type StorageImagePreview = {
  dataUrl: string;
  blobKeyPath: string;
};

export function findStorageBlobPreviews(value: unknown, recordKey?: string): StorageBlobPreviewItem[] {
  const results: StorageBlobPreviewItem[] = [];
  collectStorageBlobPreviews(value, recordKey ?? 'value', '', results);
  return results;
}

export function findStorageImagePreview(value: unknown, recordKey?: string): StorageImagePreview | null {
  const previewable = findStorageBlobPreviews(value, recordKey).find((item) => item.src);
  if (!previewable?.src) return null;

  return {
    dataUrl: previewable.src,
    blobKeyPath: previewable.blobKeyPath,
  };
}

export function formatBlobImageLabel(recordKey: string | undefined, blobKeyPath: string): string {
  if (!recordKey) return blobKeyPath;
  if (blobKeyPath === 'value' || blobKeyPath === recordKey) return recordKey;
  return `${recordKey} · ${blobKeyPath}`;
}

export function findStorageImageDataUrl(value: unknown): string | null {
  return findStorageImagePreview(value)?.dataUrl ?? null;
}

function collectStorageBlobPreviews(
  value: unknown,
  recordKey: string,
  path: string,
  results: StorageBlobPreviewItem[],
): void {
  if (typeof value === 'string') {
    const marker = parseStorageBlobMarker(value);
    if (marker) {
      pushStorageBlobPreview(marker, path || recordKey, results);
      return;
    }

    const dataUrl = findImageCandidateInUnknown(value);
    if (dataUrl) {
      results.push({
        blobKeyPath: path || recordKey,
        mimeType: 'image/*',
        src: dataUrl,
      });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const itemPath = path ? `${path}[${index}]` : `[${index}]`;
      collectStorageBlobPreviews(item, recordKey, itemPath, results);
    });
    return;
  }

  if (!value || typeof value !== 'object') return;

  const record = value as Record<string, unknown>;
  if (record.__apiFlowImageBlob || record.__apiFlowBlob) {
    pushStorageBlobPreview(record as StorageBlobMarker, path || recordKey, results);
    return;
  }

  for (const [key, nested] of Object.entries(record)) {
    const itemPath = path ? `${path}.${key}` : key;
    collectStorageBlobPreviews(nested, recordKey, itemPath, results);
  }
}

function pushStorageBlobPreview(
  marker: StorageBlobMarker,
  blobKeyPath: string,
  results: StorageBlobPreviewItem[],
): void {
  const mimeType = marker.mimeType || 'application/octet-stream';
  const size = marker.size;
  const dataUrl = typeof marker.dataUrl === 'string' ? marker.dataUrl.trim() : undefined;
  const isImage = mimeType.startsWith('image/');

  if (marker.__apiFlowImageBlob) {
    if (dataUrl && dataUrl.startsWith('data:image/')) {
      results.push({ blobKeyPath, mimeType, size, src: dataUrl });
      return;
    }

    results.push({ blobKeyPath, mimeType, size });
    return;
  }

  if (isImage && marker.__apiFlowBlob) {
    results.push({
      blobKeyPath,
      mimeType,
      size,
      unavailableReason: `Preview unavailable (over ${formatMaxImageBlobLimit()} limit)`,
    });
  }
}

function findImageCandidateInUnknown(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.startsWith('data:image/')) return trimmed;
  return null;
}
