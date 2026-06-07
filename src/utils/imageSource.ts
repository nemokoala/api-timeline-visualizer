export function getImageSource(value: unknown, mimeType?: string): string | null {
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
