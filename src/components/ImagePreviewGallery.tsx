import { useEffect, useState } from 'react';
import type { ImagePreviewItem } from '../utils/imageSource';
import {
  getStorageImageLayoutMode,
  saveStorageImageLayoutMode,
  type StorageImageLayoutMode,
} from '../utils/storageImagePrefs';
import { ImagePreview } from './ImagePreview';

type ImagePreviewGalleryProps = {
  previews: ImagePreviewItem[];
  recordKey?: string;
  blobPreviewsLoading?: boolean;
  showLayoutToggle?: boolean;
};

export function ImagePreviewGallery({
  previews,
  recordKey,
  blobPreviewsLoading = false,
  showLayoutToggle = false,
}: ImagePreviewGalleryProps) {
  const [layoutMode, setLayoutMode] = useState<StorageImageLayoutMode>(() => getStorageImageLayoutMode());

  useEffect(() => {
    saveStorageImageLayoutMode(layoutMode);
  }, [layoutMode]);

  return (
    <>
      {showLayoutToggle && previews.length > 0 ? (
        <div className="image-preview-toolbar">
          <div className="segmented-control image-preview-layout-toggle" aria-label="Image layout">
            <button
              type="button"
              className={layoutMode === 'stack' ? 'active' : ''}
              onClick={() => setLayoutMode('stack')}
            >
              Large
            </button>
            <button
              type="button"
              className={layoutMode === 'grid' ? 'active' : ''}
              onClick={() => setLayoutMode('grid')}
            >
              Grid
            </button>
          </div>
        </div>
      ) : null}
      <div className={`image-preview-stack ${layoutMode === 'grid' ? 'is-grid-layout' : ''}`}>
        {previews.map((preview) => (
          <div className="image-preview-frame" key={preview.label}>
            {recordKey ? (
              <div className="image-preview-caption">
                <span>Blob key</span>
                <strong title={preview.label}>{preview.label}</strong>
              </div>
            ) : null}
            {preview.src ? (
              <ImagePreview src={preview.src} alt={`${preview.label} preview`} />
            ) : blobPreviewsLoading && !preview.unavailableReason ? (
              <div className="image-preview-unavailable">
                <p>Loading preview...</p>
                {preview.mimeType ? <span>{preview.mimeType}</span> : null}
                {typeof preview.size === 'number' ? <span>{formatPreviewBytes(preview.size)}</span> : null}
              </div>
            ) : (
              <div className="image-preview-unavailable">
                <p>{preview.unavailableReason ?? 'Preview unavailable'}</p>
                {preview.mimeType ? <span>{preview.mimeType}</span> : null}
                {typeof preview.size === 'number' ? <span>{formatPreviewBytes(preview.size)}</span> : null}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function formatPreviewBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
