import { useState } from 'react';
import { getImageSource } from '../utils/imageSource';
import { ImagePreview } from './ImagePreview';

type ActiveFieldMenu = {
  id: string;
  value: unknown;
} | null;

type JsonViewerProps = {
  value: unknown;
  mimeType?: string;
};

export function JsonViewer({ value, mimeType }: JsonViewerProps) {
  const renderValue = coerceJson(value);
  const output = typeof renderValue === 'string' ? renderValue : JSON.stringify(renderValue, null, 2);
  const imageSource = getImageSource(value, mimeType);

  if (imageSource) {
    return (
      <div className="image-value-viewer">
        <div className="image-preview-frame">
          <ImagePreview src={imageSource} alt="Base64 response preview" />
        </div>
        <JsonBlock value={renderValue} fallback={output} />
      </div>
    );
  }

  return <JsonBlock value={renderValue} fallback={output} />;
}

function JsonBlock({ value, fallback }: { value: unknown; fallback: string }) {
  const [copied, setCopied] = useState(false);
  const [fieldMenu, setFieldMenu] = useState<ActiveFieldMenu>(null);
  const copyText = fallback || '{}';

  const handleCopy = async () => {
    const didCopy = await copyToClipboard(copyText);
    if (!didCopy) return;

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const copyButton = (
    <button className="json-copy-button" type="button" onClick={handleCopy}>
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
  const handleFieldCopy = async (mode: 'value' | 'string') => {
    if (!fieldMenu) return;

    const text = mode === 'value' ? formatCopyValue(fieldMenu.value) : formatCopyString(fieldMenu.value);
    const didCopy = await copyToClipboard(text);
    if (!didCopy) return;

    setFieldMenu(null);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  if (value && typeof value === 'object') {
    return (
      <div className="json-viewer-wrap">
        {copyButton}
        {fieldMenu ? (
          <div className="json-field-menu">
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
        <pre className="json-viewer json-tree">
          {renderJsonValue(value, 0, 'root', (id, targetValue) => {
            setFieldMenu((current) => (current?.id === id ? null : { id, value: targetValue }));
          })}
        </pre>
      </div>
    );
  }

  return (
    <div className="json-viewer-wrap">
      {copyButton}
      <pre className="json-viewer">{copyText}</pre>
    </div>
  );
}

function renderJsonValue(
  value: unknown,
  depth: number,
  path: string,
  onFieldClick: (id: string, value: unknown) => void,
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
            {renderJsonValue(item, depth + 1, `${path}.${index}`, onFieldClick)}
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
              onClick={() => onFieldClick(`${path}.${key}`, item)}
              title="Copy field value"
            >
              "{key}"
            </button>
            <span className="json-punctuation">: </span>
            {renderJsonValue(item, depth + 1, `${path}.${key}`, onFieldClick)}
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
    return <span className="json-string">"{value}"</span>;
  }

  if (typeof value === 'number') {
    return <span className="json-number">{String(value)}</span>;
  }

  if (typeof value === 'boolean') {
    return <span className="json-boolean">{String(value)}</span>;
  }

  if (value === null) {
    return <span className="json-null">null</span>;
  }

  return <span className="json-string">"{String(value)}"</span>;
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
