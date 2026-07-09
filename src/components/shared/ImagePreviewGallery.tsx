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

  const isGrid = layoutMode === 'grid';

  const unavailableClass = `grid w-full place-content-center gap-1 text-center text-ink-weak ${
    isGrid ? 'min-h-[72px] p-1.5 text-[10px] leading-[1.35]' : 'min-h-[120px] p-3 text-[12px] leading-[1.45]'
  }`;
  const metaClass = 'text-[11px] text-ink-faint';

  return (
    <>
      {showLayoutToggle && previews.length > 0 ? (
        <div className="mb-2 flex justify-end">
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
      <div
        className={`grid ${isGrid ? 'grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2' : 'gap-2.5'}`}
      >
        {previews.map((preview) => (
          <div
            className={`bg-checker-lg flex flex-col overflow-auto rounded-xl border border-line-weak ${
              isGrid ? 'items-stretch p-1.5' : 'min-h-[150px] max-h-[360px] items-center p-3.5'
            }`}
            key={preview.label}
          >
            {recordKey ? (
              <div className={`flex w-full flex-col gap-0.5 ${isGrid ? 'mb-1' : 'mb-2.5'}`}>
                <span className="text-[10px] font-bold uppercase tracking-[0.04em] text-ink-weak">
                  Blob key
                </span>
                <strong
                  className={`font-semibold leading-[1.35] text-ink-strong ${
                    isGrid
                      ? 'line-clamp-2 text-[10px]'
                      : 'overflow-hidden text-ellipsis whitespace-nowrap text-[12px]'
                  }`}
                  title={preview.label}
                >
                  {preview.label}
                </strong>
              </div>
            ) : null}
            {preview.src ? (
              <ImagePreview
                src={preview.src}
                alt={`${preview.label} preview`}
                className={`block max-w-full object-contain ${
                  isGrid ? 'max-h-[88px] w-full' : 'max-h-[320px]'
                }`}
              />
            ) : blobPreviewsLoading && !preview.unavailableReason ? (
              <div className={unavailableClass}>
                <p className="m-0 text-ink-sub">Loading preview...</p>
                {preview.mimeType ? <span className={metaClass}>{preview.mimeType}</span> : null}
                {typeof preview.size === 'number' ? (
                  <span className={metaClass}>{formatBytes(preview.size)}</span>
                ) : null}
              </div>
            ) : (
              <div className={unavailableClass}>
                <p className="m-0 text-ink-sub">
                  {preview.unavailableReason ?? 'Preview unavailable'}
                </p>
                {preview.mimeType ? <span className={metaClass}>{preview.mimeType}</span> : null}
                {typeof preview.size === 'number' ? (
                  <span className={metaClass}>{formatBytes(preview.size)}</span>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
