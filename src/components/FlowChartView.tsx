import { useCallback, useRef, type WheelEvent } from "react";
import {
  Background,
  Controls,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import type { ReactFlowInstance } from "@xyflow/react";
import type { ApiRequest, TimelineItem } from "../types/network";
import { getImageSource } from "../utils/imageSource";
import { formatDuration, formatOffset, getStatusTone } from "./formatters";
import { ImagePreview } from "./ImagePreview";

type FlowChartViewProps = {
  items: TimelineItem[];
  requests: ApiRequest[];
  selectedRequestId: string | null;
  groupByTime: boolean;
  onSelectRequest: (requestId: string) => void;
};

const NODE_WIDTH = 240;
const NODE_HEIGHT = 152;
const COLUMN_GAP = 40;
const ROW_GAP = 32;
const NODES_PER_ROW = 3;
const PARALLEL_GROUP_THRESHOLD_MS = 120;
const MIN_ZOOM = 0.12;
const MAX_ZOOM = 1.6;
const WHEEL_ZOOM_SENSITIVITY = 0.00065;

export function FlowChartView({
  items,
  requests,
  selectedRequestId,
  groupByTime,
  onSelectRequest,
}: FlowChartViewProps) {
  const flowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const requestById = new Map(requests.map((request) => [request.id, request]));
  const groups = groupByTime ? toTimeGroups(items) : [];
  const nodes = toFlowNodes(
    items,
    requestById,
    selectedRequestId,
    groupByTime,
    groups,
  );
  const edges = toFlowEdges(items, groupByTime, groups);
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
    <section
      className="flow-panel"
      aria-label="Request flow chart"
      onWheel={handleWheel}
    >
      {items.length === 0 ? (
        <div className="empty-state">
          <strong>No API flow captured.</strong>
          <span>
            Open DevTools, trigger API traffic, then inspect the inferred
            request sequence here.
          </span>
        </div>
      ) : (
        <>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            fitViewOptions={{ padding: 0.12 }}
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
            onNodeClick={(_, node) =>
              onSelectRequest(String(node.data.requestId))
            }
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
  groupByTime: boolean,
  groups: TimelineItem[][],
): Node[] {
  return items.map((item, index) => {
    const request = requestById.get(item.requestId);
    const statusTone = getStatusTone(item.status);
    const imageSource =
      getImageSource(item.path) ??
      getImageSource(item.normalizedPath) ??
      getImageSource(request?.url);
    const position = groupByTime
      ? getGroupedPosition(item, groups)
      : getGridPosition(index);
    const bodySummary = getBodySummary(request);

    return {
      id: item.requestId,
      type: "default",
      position,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        requestId: item.requestId,
        label: (
          <div
            className={`flow-node ${selectedRequestId === item.requestId ? "selected" : ""}`}
          >
            <div className="flow-node-top">
              <span className={`method method-${item.method.toLowerCase()}`}>
                {item.method}
              </span>
              <span className={`flow-status ${statusTone}`}>
                {item.status || "n/a"}
              </span>
            </div>
            {imageSource ? (
              <div className="flow-node-image-title">
                <ImagePreview src={imageSource} alt="Base64 request preview" />
                <strong title={item.path}>Image payload</strong>
              </div>
            ) : (
              <strong title={item.path}>{getNodeTitle(item)}</strong>
            )}
            <div className="flow-node-summary">
              {bodySummary.map((summary) => (
                <span key={summary}>{summary}</span>
              ))}
            </div>
            <div className="flow-node-bottom">
              <span>{formatOffset(item.startOffset)}</span>
              <span className={item.isSlow ? "slow-text" : ""}>
                {formatDuration(request?.duration ?? item.duration)}
              </span>
            </div>
          </div>
        ),
      },
      style: {
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        border: "0",
        padding: 0,
        background: "transparent",
      },
    };
  });
}

function getNodeTitle(item: TimelineItem): string {
  if (item.normalizedPath === "/") return "Root document";
  return item.normalizedPath;
}

function toFlowEdges(
  items: TimelineItem[],
  groupByTime: boolean,
  groups: TimelineItem[][],
): Edge[] {
  if (groupByTime) {
    return groups.slice(1).map((group, index) => {
      const previous = groups[index][groups[index].length - 1];
      const next = group[0];
      const isError = group.some((item) => item.isError);

      return createEdge(previous, next, isError);
    });
  }

  return items.slice(1).map((item, index) => {
    const previous = items[index];
    return createEdge(previous, item, item.isError);
  });
}

function createEdge(
  source: TimelineItem,
  target: TimelineItem,
  isError: boolean,
): Edge {
  return {
    id: `${source.requestId}-${target.requestId}`,
    source: source.requestId,
    target: target.requestId,
    type: "straight",
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: isError ? "#ff6b6b" : "#5e6c7f",
    },
    style: {
      stroke: isError ? "#ff6b6b" : "#5e6c7f",
      strokeWidth: isError ? 2.4 : 1.8,
    },
  };
}

function getGridPosition(index: number): { x: number; y: number } {
  const column = index % NODES_PER_ROW;
  const row = Math.floor(index / NODES_PER_ROW);
  return {
    x: column * (NODE_WIDTH + COLUMN_GAP),
    y: row * (NODE_HEIGHT + ROW_GAP),
  };
}

function getGroupedPosition(
  item: TimelineItem,
  groups: TimelineItem[][],
): { x: number; y: number } {
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const itemIndex = groups[groupIndex].findIndex(
      (candidate) => candidate.requestId === item.requestId,
    );
    if (itemIndex >= 0) {
      return {
        x: itemIndex * (NODE_WIDTH + COLUMN_GAP),
        y: groupIndex * (NODE_HEIGHT + ROW_GAP),
      };
    }
  }

  return { x: 0, y: 0 };
}

function toTimeGroups(items: TimelineItem[]): TimelineItem[][] {
  return items.reduce<TimelineItem[][]>((groups, item) => {
    const currentGroup = groups[groups.length - 1];
    const firstInGroup = currentGroup?.[0];

    if (
      !currentGroup ||
      !firstInGroup ||
      item.startOffset - firstInGroup.startOffset > PARALLEL_GROUP_THRESHOLD_MS
    ) {
      groups.push([item]);
      return groups;
    }

    currentGroup.push(item);
    return groups;
  }, []);
}

function getBodySummary(request?: ApiRequest): string[] {
  if (!request) return ["No request metadata"];
  const source = request.responsePreview ?? request.requestBody;
  const summary = summarizeValue(source);

  if (summary.length) return summary;
  if (request.method !== "GET" && request.requestBody !== undefined)
    return ["Payload available"];
  if (request.size) return [`${formatBytes(request.size)}`];

  return ["Body summary unavailable"];
}

function summarizeValue(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (typeof value === "string") {
    const parsed = parseJsonString(value);
    if (parsed !== undefined) return summarizeValue(parsed);
    const trimmed = value.replace(/\s+/g, " ").trim();
    return trimmed ? [trimmed.slice(0, 72)] : [];
  }

  if (Array.isArray(value)) {
    if (!value.length) return ["array[0]"];
    const first = value[0];
    const firstLabel =
      first && typeof first === "object"
        ? summarizeObject(first as Record<string, unknown>)[0]
        : String(first);
    return [`array[${value.length}]`, firstLabel].filter(Boolean).slice(0, 2);
  }

  if (typeof value === "object") {
    return summarizeObject(value as Record<string, unknown>);
  }

  return [String(value)];
}

function summarizeObject(value: Record<string, unknown>): string[] {
  const priorityKeys = [
    "success",
    "status",
    "code",
    "message",
    "error",
    "count",
    "id",
    "name",
    "type",
  ];
  const entries = Object.entries(value);
  const selected = [
    ...priorityKeys
      .filter((key) => Object.prototype.hasOwnProperty.call(value, key))
      .map((key) => [key, value[key]] as [string, unknown]),
    ...entries.filter(([key]) => !priorityKeys.includes(key)),
  ];

  return selected
    .slice(0, 3)
    .map(([key, item]) => `${key}: ${formatSummaryValue(item)}`);
}

function formatSummaryValue(value: unknown): string {
  if (Array.isArray(value)) return `array[${value.length}]`;
  if (value && typeof value === "object") return "{...}";
  if (typeof value === "string") return value.replace(/\s+/g, " ").slice(0, 36);
  if (value === null) return "null";
  return String(value);
}

function parseJsonString(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (
    !(
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    )
  ) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
