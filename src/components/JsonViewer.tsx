import { getImageSource } from '../utils/imageSource';
import { ImagePreview } from './ImagePreview';

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
  if (value && typeof value === 'object') {
    return <pre className="json-viewer json-tree">{renderJsonValue(value, 0)}</pre>;
  }

  return <pre className="json-viewer">{fallback || '{}'}</pre>;
}

function renderJsonValue(value: unknown, depth: number): React.ReactNode {
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="json-punctuation">[]</span>;

    return (
      <>
        <span className="json-punctuation">[</span>
        {value.map((item, index) => (
          <span key={index}>
            {'\n'}
            {indent(depth + 1)}
            {renderJsonValue(item, depth + 1)}
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
            <span className="json-key">"{key}"</span>
            <span className="json-punctuation">: </span>
            {renderJsonValue(item, depth + 1)}
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
