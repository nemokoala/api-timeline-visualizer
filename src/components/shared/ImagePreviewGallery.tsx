import type { ImagePreviewItem } from '../../utils/imageSource';
import { usePersistedState } from '../../hooks/usePersistedState';
import {
  getStorageImageLayoutMode,
  saveStorageImageLayoutMode,
  type StorageImageLayoutMode,
} from '../../utils/storageImagePrefs';
import { formatBytes } from '../../utils/formatters';
import { ImagePreview } from './ImagePreview';
import { SegmentedControl } from '../ui/SegmentedControl';

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
  const [layoutMode, setLayoutMode] = usePersistedState<StorageImageLayoutMode>(
    getStorageImageLayoutMode,
    saveStorageImageLayoutMode,
  );

  return (
    <>
      {showLayoutToggle && previews.length > 0 ? (
        <div className="image-preview-toolbar">
          <SegmentedControl
            size="sm"
            ariaLabel="Image layout"
            value={layoutMode}
            onChange={setLayoutMode}
            options={[
              { value: 'stack', label: 'Large' },
              { value: 'grid', label: 'Grid' },
            ]}
          />
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
                {typeof preview.size === 'number' ? <span>{formatBytes(preview.size)}</span> : null}
              </div>
            ) : (
              <div className="image-preview-unavailable">
                <p>{preview.unavailableReason ?? 'Preview unavailable'}</p>
                {preview.mimeType ? <span>{preview.mimeType}</span> : null}
                {typeof preview.size === 'number' ? <span>{formatBytes(preview.size)}</span> : null}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
