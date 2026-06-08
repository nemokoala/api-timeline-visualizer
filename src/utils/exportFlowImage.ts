import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react';
import { toPng } from 'html-to-image';

const MIN_ZOOM = 0.12;
const MAX_ZOOM = 2;
const VIEWPORT_PADDING = 0.12;
const MAX_IMAGE_DIMENSION = 4096;
const MIN_IMAGE_DIMENSION = 640;
const DEFAULT_NODE_WIDTH = 240;
const DEFAULT_NODE_HEIGHT = 152;

function resolveNodeSize(node: Node): { width: number; height: number } {
  const width = node.measured?.width ?? node.width ?? Number(node.style?.width) ?? DEFAULT_NODE_WIDTH;
  const height = node.measured?.height ?? node.height ?? Number(node.style?.height) ?? DEFAULT_NODE_HEIGHT;
  return { width, height };
}

function resolveNodesBounds(nodes: Node[]) {
  const measured = getNodesBounds(nodes);
  if (measured.width > 0 && measured.height > 0) return measured;

  if (!nodes.length) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    const { width, height } = resolveNodeSize(node);
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + width);
    maxY = Math.max(maxY, node.position.y + height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function getImageDimensions(bounds: { width: number; height: number }): { width: number; height: number } {
  const paddedWidth = Math.max(bounds.width * (1 + VIEWPORT_PADDING * 2), 1);
  const paddedHeight = Math.max(bounds.height * (1 + VIEWPORT_PADDING * 2), 1);
  const scale = Math.min(2, MAX_IMAGE_DIMENSION / Math.max(paddedWidth, paddedHeight));

  return {
    width: Math.ceil(Math.max(MIN_IMAGE_DIMENSION, paddedWidth * scale)),
    height: Math.ceil(Math.max(480, paddedHeight * scale)),
  };
}

async function downloadDataUrl(dataUrl: string, filename: string): Promise<void> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = objectUrl;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export async function exportFlowChartToPng(
  viewportElement: HTMLElement,
  nodes: Node[],
  filename: string,
): Promise<void> {
  const nodesBounds = resolveNodesBounds(nodes);
  if (nodesBounds.width <= 0 || nodesBounds.height <= 0) {
    throw new Error('No flow content to export.');
  }

  const { width: imageWidth, height: imageHeight } = getImageDimensions(nodesBounds);
  const viewport = getViewportForBounds(
    nodesBounds,
    imageWidth,
    imageHeight,
    MIN_ZOOM,
    MAX_ZOOM,
    VIEWPORT_PADDING,
  );

  const dataUrl = await toPng(viewportElement, {
    backgroundColor: '#11151b',
    width: imageWidth,
    height: imageHeight,
    pixelRatio: 1,
    skipFonts: true,
    cacheBust: true,
    style: {
      width: `${imageWidth}px`,
      height: `${imageHeight}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
    filter: (node) => {
      if (!(node instanceof HTMLElement)) return true;
      return !node.classList?.contains('react-flow__controls');
    },
  });

  await downloadDataUrl(dataUrl, filename);
}
