import { useEffect, useState } from 'react';

type ImagePreviewProps = {
  src: string;
  alt: string;
};

export function ImagePreview({ src, alt }: ImagePreviewProps) {
  const [displaySrc, setDisplaySrc] = useState(src);

  useEffect(() => {
    if (!src.startsWith('data:image/')) {
      setDisplaySrc(src);
      return;
    }

    const objectUrl = dataUrlToObjectUrl(src);
    if (!objectUrl) {
      setDisplaySrc(src);
      return;
    }

    setDisplaySrc(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [src]);

  return <img src={displaySrc} alt={alt} />;
}

function dataUrlToObjectUrl(src: string): string | null {
  const match = src.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) return null;

  try {
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return URL.createObjectURL(new Blob([bytes], { type: match[1] }));
  } catch {
    return null;
  }
}
