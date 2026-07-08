import {
  findStorageBlobPreviews,
  findStorageImageDataUrl,
  findStorageImagePreview,
  formatBlobImageLabel,
  type StorageBlobPreviewItem,
} from './storageBlobValue';

export function getImageSource(value: unknown, mimeType?: string, recordKey?: string): string | null {
  const storageImage = findStorageImagePreview(value, recordKey)?.dataUrl ?? findStorageImageDataUrl(value);
  if (storageImage) return storageImage;

  const candidate = findImageCandidate(value);
  if (!candidate) return null;

  const dataImageBase64 = candidate.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (dataImageBase64) {
    return `data:${dataImageBase64[1]};base64,${sanitizeBase64(dataImageBase64[2])}`;
  }

  const imageMimeBase64 = candidate.match(/^(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (imageMimeBase64) {
    return `data:${imageMimeBase64[1]};base64,${sanitizeBase64(imageMimeBase64[2])}`;
  }

  if (mimeType?.startsWith('image/') && isLikelyBase64(candidate)) {
    return `data:${mimeType};base64,${sanitizeBase64(candidate)}`;
  }

  return null;
}

/**
 * 리스트 썸네일로 그리기엔 지나치게 큰 이미지는 건너뛴다. 작은 셀 하나를 위해
 * 수 MB짜리 base64를 풀 해상도로 디코드하면 목록이 심하게 버벅인다.
 */
const MAX_THUMBNAIL_BASE64_LENGTH = 512 * 1024;

/**
 * 이미지 요청의 응답 본문(getContent 결과)에서 썸네일용 data URL을 만든다.
 * 바이너리 이미지는 base64 문자열로, SVG는 텍스트로 들어오므로 각각 처리한다.
 */
export function getResponseImageThumbnail(content: string | undefined, mimeType?: string): string | null {
  if (!content || !mimeType?.startsWith('image/')) return null;
  if (content.length > MAX_THUMBNAIL_BASE64_LENGTH) return null;

  const direct = getImageSource(content, mimeType);
  if (direct) return direct;

  // getContent가 SVG를 base64가 아니라 원본 텍스트로 돌려주는 경우.
  if (mimeType.includes('svg') && content.includes('<svg')) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(content)}`;
  }

  return null;
}

function findImageCandidate(value: unknown): string | null {
  if (typeof value === 'string') return value.trim();

  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const preferredKeys = ['image', 'base64', 'data', 'content', 'body'];

  for (const key of preferredKeys) {
    const nested = record[key];
    if (typeof nested === 'string') return nested.trim();
  }

  return null;
}

function isLikelyBase64(value: string): boolean {
  const sanitized = sanitizeBase64(value);
  if (sanitized.length < 80 || sanitized.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(sanitized);
}

function sanitizeBase64(value: string): string {
  return value.replace(/\s/g, '');
}

export function getImagePreview(
  value: unknown,
  mimeType?: string,
  recordKey?: string,
): { src: string; label: string } | null {
  const preview = getImagePreviews(value, mimeType, recordKey).find((item) => item.src);
  if (!preview?.src) return null;

  return {
    src: preview.src,
    label: preview.label,
  };
}

export type ImagePreviewItem = {
  src?: string;
  label: string;
  mimeType?: string;
  size?: number;
  unavailableReason?: string;
};

export function getImagePreviews(
  value: unknown,
  mimeType?: string,
  recordKey?: string,
): ImagePreviewItem[] {
  const storagePreviews = findStorageBlobPreviews(value, recordKey);
  if (storagePreviews.length > 0) {
    return toImagePreviewItems(storagePreviews, recordKey);
  }

  const src = getImageSource(value, mimeType, recordKey);
  if (!src) return [];

  return [
    {
      src,
      label: recordKey ?? 'Response image',
    },
  ];
}

export function toImagePreviewItems(
  items: StorageBlobPreviewItem[],
  recordKey?: string,
): ImagePreviewItem[] {
  return items.map((item) => ({
    src: item.src,
    label: formatBlobImageLabel(recordKey, item.blobKeyPath),
    mimeType: item.mimeType,
    size: item.size,
    unavailableReason: item.unavailableReason,
  }));
}

export function mergeBlobPreviewItems(
  metadata: StorageBlobPreviewItem[],
  fetched: StorageBlobPreviewItem[],
  recordKey?: string,
): ImagePreviewItem[] {
  const source = metadata.length > 0 ? metadata : fetched;
  return source.map((meta) => {
    const match = fetched.find((item) => item.blobKeyPath === meta.blobKeyPath);
    return {
      src: match?.src ?? meta.src,
      label: formatBlobImageLabel(recordKey, meta.blobKeyPath),
      mimeType: match?.mimeType ?? meta.mimeType,
      size: match?.size ?? meta.size,
      unavailableReason: match?.unavailableReason ?? meta.unavailableReason,
    };
  });
}
