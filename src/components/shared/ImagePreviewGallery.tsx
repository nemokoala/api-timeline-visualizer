import type { ImagePreviewItem } from '../../utils/imageSource';
import { usePersistedState } from '../../hooks/usePersistedState';
import {
  getStorageImageGridSize,
  getStorageImageLayoutMode,
  saveStorageImageGridSize,
  saveStorageImageLayoutMode,
  GRID_SIZE_MAX,
  GRID_SIZE_MIN,
  type StorageImageLayoutMode,
} from '../../utils/storageImagePrefs';
import { formatBytes } from '../../utils/formatters';
import { useT } from '../../i18n';
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
  const t = useT();
  const [layoutMode, setLayoutMode] = usePersistedState<StorageImageLayoutMode>(
    getStorageImageLayoutMode,
    saveStorageImageLayoutMode,
  );
  const [gridSize, setGridSize] = usePersistedState<number>(
    getStorageImageGridSize,
    saveStorageImageGridSize,
  );

  const isGrid = layoutMode === 'grid';

  const unavailableClass = `grid w-full place-content-center gap-1 text-center text-ink-weak ${
    isGrid ? 'min-h-[72px] p-1.5 text-[10px] leading-[1.35]' : 'min-h-[120px] p-3 text-[12px] leading-[1.45]'
  }`;
  const metaClass = 'text-[11px] text-ink-faint';

  // 타일 크기는 최소 폭일 뿐이고 열 개수는 auto-fill이 패널 폭에 맞춰 정한다.
  // 이미지는 타일 안쪽 여백·라벨을 뺀 만큼만 차지하게 해 카드가 세로로 늘어지지 않게 한다.
  const gridStyle = isGrid
    ? { gridTemplateColumns: `repeat(auto-fill, minmax(${gridSize}px, 1fr))` }
    : undefined;
  const gridImageStyle = isGrid ? { maxHeight: Math.round(gridSize * 0.85) } : undefined;

  return (
    <>
      {showLayoutToggle && previews.length > 0 ? (
        <div className="mb-2 flex items-center justify-end gap-2">
          {/* 크기 슬라이더는 그리드일 때만 의미가 있다(Large는 카드 한 장씩 크게 본다). */}
          {isGrid ? (
            <input
              type="range"
              className="h-1 w-24 cursor-pointer accent-[var(--blue)]"
              min={GRID_SIZE_MIN}
              max={GRID_SIZE_MAX}
              step={8}
              value={gridSize}
              onChange={(event) => setGridSize(Number(event.target.value))}
              aria-label={t('imageGallery.gridSize')}
              title={t('imageGallery.gridSizeTitle', { size: String(gridSize) })}
            />
          ) : null}
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
      <div className={`grid ${isGrid ? 'gap-2' : 'gap-2.5'}`} style={gridStyle}>
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
                  isGrid ? 'w-full' : 'max-h-[320px]'
                }`}
                style={gridImageStyle}
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
