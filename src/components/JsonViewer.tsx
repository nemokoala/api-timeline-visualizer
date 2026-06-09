import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { highlightSearchText } from '../utils/searchHighlight';
import { getImagePreviews, mergeBlobPreviewItems, type ImagePreviewItem } from '../utils/imageSource';
import { fetchStorageRecordBlobPreviews } from '../utils/storageInspector';
import { findStorageBlobPreviews, sanitizeStorageBlobsForDisplay } from '../utils/storageBlobValue';
import { DetailSection } from './DetailSection';
import { ImagePreview } from './ImagePreview';

type ActiveFieldMenu = {
  id: string;
  value: unknown;
  left: number;
  top: number;
} | null;

type JsonViewerProps = {
  value: unknown;
  mimeType?: string;
  searchText?: string;
  instanceId?: string;
  recordKey?: string;
  blobPreviewRequest?: {
    databaseName: string;
    storeName: string;
    recordIndex: number;
  };
};

export function JsonViewer({
  value,
  mimeType,
  searchText = '',
  instanceId,
  recordKey,
  blobPreviewRequest,
}: JsonViewerProps) {
  const [fetchedBlobPreviews, setFetchedBlobPreviews] = useState<Awaited<
    ReturnType<typeof fetchStorageRecordBlobPreviews>
  >>([]);
  const [blobPreviewsLoading, setBlobPreviewsLoading] = useState(false);
  const renderValue = coerceJson(value);
  const displayValue = sanitizeStorageBlobsForDisplay(renderValue);
  const output =
    typeof displayValue === 'string' ? displayValue : JSON.stringify(displayValue, null, 2);

  useEffect(() => {
    if (!blobPreviewRequest) {
      setFetchedBlobPreviews([]);
      setBlobPreviewsLoading(false);
      return;
    }

    let cancelled = false;
    setBlobPreviewsLoading(true);

    void fetchStorageRecordBlobPreviews(
      blobPreviewRequest.databaseName,
      blobPreviewRequest.storeName,
      blobPreviewRequest.recordIndex,
    )
      .then((previews) => {
        if (!cancelled) setFetchedBlobPreviews(previews);
      })
      .catch(() => {
        if (!cancelled) setFetchedBlobPreviews([]);
      })
      .finally(() => {
        if (!cancelled) setBlobPreviewsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [blobPreviewRequest, instanceId]);

  const imagePreviews: ImagePreviewItem[] = blobPreviewRequest
    ? mergeBlobPreviewItems(findStorageBlobPreviews(renderValue, recordKey), fetchedBlobPreviews, recordKey)
    : getImagePreviews(renderValue, mimeType, recordKey);

  if (imagePreviews.length > 0) {
    const sectionPrefix = instanceId ?? 'json-viewer';

    return (
      <div className="json-value-sections">
        <DetailSection
          sectionId={`${sectionPrefix}:images`}
          title={imagePreviews.length > 1 ? 'Images' : 'Image'}
          defaultOpen
        >
          <div className="image-preview-stack">
            {imagePreviews.map((preview) => (
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
                    {typeof preview.size === 'number' ? (
                      <span>{formatPreviewBytes(preview.size)}</span>
                    ) : null}
                  </div>
                ) : (
                  <div className="image-preview-unavailable">
                    <p>{preview.unavailableReason ?? 'Preview unavailable'}</p>
                    {preview.mimeType ? <span>{preview.mimeType}</span> : null}
                    {typeof preview.size === 'number' ? (
                      <span>{formatPreviewBytes(preview.size)}</span>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        </DetailSection>
        <DetailSection sectionId={`${sectionPrefix}:json`} title="JSON" defaultOpen>
          <JsonBlock
            value={displayValue}
            fallback={output}
            searchText={searchText}
            instanceId={instanceId}
          />
        </DetailSection>
      </div>
    );
  }

  return (
    <JsonBlock
      value={displayValue}
      fallback={output}
      searchText={searchText}
      instanceId={instanceId}
    />
  );
}

function JsonBlock({
  value,
  fallback,
  searchText,
  instanceId,
}: {
  value: unknown;
  fallback: string;
  searchText: string;
  instanceId?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [fieldMenu, setFieldMenu] = useState<ActiveFieldMenu>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerBodyRef = useRef<HTMLDivElement>(null);
  const copyText = fallback || '{}';
  const isObject = Boolean(value && typeof value === 'object');

  useEffect(() => {
    setFieldMenu(null);
    setIsFullscreen(false);
    setCopied(false);
  }, [instanceId]);

  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullscreen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!fieldMenu) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFieldMenu(null);
    };

    const viewer = viewerBodyRef.current?.querySelector('.json-viewer');
    const closeMenu = () => setFieldMenu(null);

    window.addEventListener('keydown', handleKeyDown);
    viewer?.addEventListener('scroll', closeMenu);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      viewer?.removeEventListener('scroll', closeMenu);
    };
  }, [fieldMenu]);

  const handleCopy = async () => {
    const didCopy = await copyToClipboard(copyText);
    if (!didCopy) return;

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const handleFieldCopy = async (mode: 'value' | 'string') => {
    if (!fieldMenu) return;

    const text = mode === 'value' ? formatCopyValue(fieldMenu.value) : formatCopyString(fieldMenu.value);
    const didCopy = await copyToClipboard(text);
    if (!didCopy) return;

    setFieldMenu(null);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const handleFieldClick = (id: string, targetValue: unknown, event: MouseEvent<HTMLButtonElement>) => {
    if (fieldMenu?.id === id) {
      setFieldMenu(null);
      return;
    }

    const body = viewerBodyRef.current;
    const button = event.currentTarget;
    if (!body) return;

    const bodyRect = body.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const menuWidth = 196;
    const left = clamp(buttonRect.left - bodyRect.left, 8, Math.max(8, bodyRect.width - menuWidth - 8));
    const top = buttonRect.top - bodyRect.top;

    setFieldMenu({ id, value: targetValue, left, top });
  };

  return (
    <>
      {isFullscreen ? (
        <div className="json-fullscreen-backdrop" onClick={() => setIsFullscreen(false)} aria-hidden="true" />
      ) : null}
      <div
        className={`json-viewer-wrap${isFullscreen ? ' is-fullscreen' : ''}`}
        role={isFullscreen ? 'dialog' : undefined}
        aria-modal={isFullscreen ? true : undefined}
        aria-label={isFullscreen ? 'JSON fullscreen' : undefined}
      >
        <div className="json-viewer-toolbar">
          <div className="json-viewer-actions">
            <button
              className="json-fullscreen-button"
              type="button"
              onClick={() => setIsFullscreen((current) => !current)}
            >
              {isFullscreen ? 'Close' : 'Fullscreen'}
            </button>
            <button className="json-copy-button" type="button" onClick={handleCopy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
        <div className="json-viewer-body" ref={viewerBodyRef}>
          {fieldMenu ? (
            <div
              className="json-field-menu json-field-menu-floating"
              style={{ left: fieldMenu.left, top: fieldMenu.top }}
            >
              <button type="button" onClick={() => handleFieldCopy('value')}>
                값 복사
              </button>
              <button type="button" onClick={() => handleFieldCopy('string')}>
                문자열 복사
              </button>
              <button type="button" onClick={() => setFieldMenu(null)} aria-label="Close field copy menu">
                ×
              </button>
            </div>
          ) : null}
          {isObject ? (
            <pre className="json-viewer json-tree">
              {renderJsonValue(value, 0, 'root', handleFieldClick, searchText)}
            </pre>
          ) : (
            <pre className="json-viewer">{highlightSearchText(copyText, searchText)}</pre>
          )}
        </div>
      </div>
    </>
  );
}

function renderJsonValue(
  value: unknown,
  depth: number,
  path: string,
  onFieldClick: (id: string, value: unknown, event: MouseEvent<HTMLButtonElement>) => void,
  searchText: string,
): React.ReactNode {
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="json-punctuation">[]</span>;

    return (
      <>
        <span className="json-punctuation">[</span>
        {value.map((item, index) => (
          <span key={index}>
            {'\n'}
            {indent(depth + 1)}
            {renderJsonValue(item, depth + 1, `${path}.${index}`, onFieldClick, searchText)}
            {index < value.length - 1 ? <span className="json-punctuation">,</span> : null}
          </span>
        ))}
        {'\n'}
        {indent(depth)}
        <span className="json-punctuation">]</span>
      </>
    );
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="json-punctuation">{'{}'}</span>;

    return (
      <>
        <span className="json-punctuation">{'{'}</span>
        {entries.map(([key, item], index) => (
          <span key={key}>
            {'\n'}
            {indent(depth + 1)}
            <button
              className="json-key json-key-button"
              type="button"
              onClick={(event) => onFieldClick(`${path}.${key}`, item, event)}
              title="Copy field value"
            >
              "{highlightSearchText(key, searchText)}"
            </button>
            <span className="json-punctuation">: </span>
            {renderJsonValue(item, depth + 1, `${path}.${key}`, onFieldClick, searchText)}
            {index < entries.length - 1 ? <span className="json-punctuation">,</span> : null}
          </span>
        ))}
        {'\n'}
        {indent(depth)}
        <span className="json-punctuation">{'}'}</span>
      </>
    );
  }

  if (typeof value === 'string') {
    return (
      <span className="json-string">
        "{highlightSearchText(value, searchText)}"
      </span>
    );
  }

  if (typeof value === 'number') {
    return <span className="json-number">{highlightSearchText(String(value), searchText)}</span>;
  }

  if (typeof value === 'boolean') {
    return <span className="json-boolean">{highlightSearchText(String(value), searchText)}</span>;
  }

  if (value === null) {
    return <span className="json-null">null</span>;
  }

  return (
    <span className="json-string">
      "{highlightSearchText(String(value), searchText)}"
    </span>
  );
}

function coerceJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed) return value;

  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }

  return value;
}

function indent(depth: number): string {
  return '  '.repeat(depth);
}

function formatCopyValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function formatCopyString(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (value === null || value === undefined) return String(value);
  return JSON.stringify(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatPreviewBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function copyToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const result = document.execCommand('copy');
    document.body.removeChild(textarea);
    return result;
  } catch {
    return false;
  }
}
