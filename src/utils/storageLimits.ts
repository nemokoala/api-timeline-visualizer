export const MAX_IMAGE_BLOB_BYTES = 32 * 1024 * 1024;

export function formatMaxImageBlobLimit(): string {
  return `${MAX_IMAGE_BLOB_BYTES / (1024 * 1024)} MB`;
}
