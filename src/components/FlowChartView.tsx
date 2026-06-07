import { useCallback, useRef, type WheelEvent } from 'react';
import { Background, Controls, MarkerType, Position, ReactFlow, type Edge, type Node } from '@xyflow/react';
import type { ReactFlowInstance } from '@xyflow/react';
import type { ApiRequest, TimelineItem } from '../types/network';
import { getImageSource } from '../utils/imageSource';
import { formatDuration, formatOffset, getStatusTone } from './formatters';
import { ImagePreview } from './ImagePreview';

type FlowChartViewProps = {
  items: TimelineItem[];
  requests: ApiRequest[];
  selectedRequestId: string | null;
  onSelectRequest: (requestId: string) => void;
};

const NODE_WIDTH = 240;
const NODE_HEIGHT = 152;
const COLUMN_GAP = 96;
const ROW_GAP = 96;
const NODES_PER_ROW = 3;
const MIN_ZOOM = 0.12;
const MAX_ZOOM = 1.6;
const WHEEL_ZOOM_SENSITIVITY = 0.00065;

export function FlowChartView({ items, requests, selectedRequestId, onSelectRequest }: FlowChartViewProps) {
  const flowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const requestById = new Map(requests.map((request) => [request.id, request]));
  const nodes = toFlowNodes(items, requestById, selectedRequestId);
  const edges = toFlowEdges(items);
  const handleWheel = useCallback((event: WheelEvent<HTMLElement>) => {
    const flowInstance = flowInstanceRef.current;
    if (!flowInstance) return;

    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const viewport = flowInstance.getViewport();
    const pointerX = event.clientX - bounds.left;
    const pointerY = event.clientY - bounds.top;
    const flowX = (pointerX - viewport.x) / viewport.zoom;
    const flowY = (pointerY - viewport.y) / viewport.zoom;
    const nextZoom = clamp(
      viewport.zoom * Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY),
      MIN_ZOOM,
      MAX_ZOOM,
    );

    flowInstance.setViewport(
      {
        x: pointerX - flowX * nextZoom,
        y: pointerY - flowY * nextZoom,
        zoom: nextZoom,
      },
      { duration: 80 },
    );
  }, []);

  return (
    <section className="flow-panel" aria-label="Request flow chart" onWheel={handleWheel}>
      {items.length === 0 ? (
        <div className="empty-state">
          <strong>No API flow captured.</strong>
          <span>Open DevTools, trigger API traffic, then inspect the inferred request sequence here.</span>
        </div>
      ) : (
        <>
          <div className="flow-caption">
            <strong>Inferred Sequence</strong>
            <span>Ordered by request start time, not a guaranteed dependency graph.</span>
          </div>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            fitViewOptions={{ padding: 0.16 }}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            nodesDraggable={false}
            panOnDrag
            panOnScroll={false}
            zoomOnScroll={false}
            zoomOnPinch
            onInit={(instance) => {
              flowInstanceRef.current = instance;
            }}
            onNodeClick={(_, node) => onSelectRequest(String(node.data.requestId))}
          >
            <Background color="#27313d" gap={22} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </>
      )}
    </section>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toFlowNodes(
  items: TimelineItem[],
  requestById: Map<string, ApiRequest>,
  selectedRequestId: string | null,
): Node[] {
  return items.map((item, index) => {
    const request = requestById.get(item.requestId);
    const statusTone = getStatusTone(item.status);
    const imageSource = getImageSource(item.path) ?? getImageSource(item.normalizedPath) ?? getImageSource(request?.url);
    const column = index % NODES_PER_ROW;
    const row = Math.floor(index / NODES_PER_ROW);
    const x = column * (NODE_WIDTH + COLUMN_GAP);
    const y = row * (NODE_HEIGHT + ROW_GAP);

    return {
      id: item.requestId,
      type: 'default',
      position: { x, y },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        requestId: item.requestId,
        label: (
          <div className={`flow-node ${selectedRequestId === item.requestId ? 'selected' : ''}`}>
            <div className="flow-node-top">
              <span className={`method method-${item.method.toLowerCase()}`}>{item.method}</span>
              <span className={`flow-status ${statusTone}`}>{item.status || 'n/a'}</span>
            </div>
            {imageSource ? (
              <div className="flow-node-image-title">
                <ImagePreview src={imageSource} alt="Base64 request preview" />
                <strong title={item.path}>Image payload</strong>
              </div>
            ) : (
              <strong title={item.path}>{getNodeTitle(item)}</strong>
            )}
            <span>{item.host}</span>
            <div className="flow-node-bottom">
              <span>{formatOffset(item.startOffset)}</span>
              <span className={item.isSlow ? 'slow-text' : ''}>{formatDuration(request?.duration ?? item.duration)}</span>
            </div>
          </div>
        ),
      },
      style: {
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        border: '0',
        padding: 0,
        background: 'transparent',
      },
    };
  });
}

function getNodeTitle(item: TimelineItem): string {
  if (item.normalizedPath === '/') return 'Root document';
  return item.normalizedPath;
}

function toFlowEdges(items: TimelineItem[]): Edge[] {
  return items.slice(1).map((item, index) => {
    const previous = items[index];
    const isError = item.isError;

    return {
      id: `${previous.requestId}-${item.requestId}`,
      source: previous.requestId,
      target: item.requestId,
      type: 'straight',
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, color: isError ? '#ff6b6b' : '#5e6c7f' },
      style: {
        stroke: isError ? '#ff6b6b' : '#5e6c7f',
        strokeWidth: isError ? 2.4 : 1.8,
      },
    };
  });
}
