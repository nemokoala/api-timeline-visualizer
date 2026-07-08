/**
 * Flow 차트의 그래프 빌더·자동 배치 헬퍼.
 * TimelineItem 목록을 React Flow 노드/엣지로 변환하고, 신규 노드의 자동 위치와
 * 도형/메모의 z-order를 계산한다. (React Flow 상태 관리는 FlowChartView 담당.)
 */
import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { ApiRequest, TimelineItem } from "../../types/network";
import type { FlowShape, FlowTextNote } from "../../utils/flowLayoutPrefs";
import type { RequestSearchSummary } from "../../utils/requestSearch";
import {
  formatBytes,
  formatDateTime,
  formatDuration,
  getStatusTone,
} from "../../utils/formatters";
import { getImageSource } from "../../utils/imageSource";
import { ImagePreview } from "../shared/ImagePreview";
import { SearchHitBadge } from "./SearchHitBadge";
import {
  AUTO_CONTINUATION_COLUMNS,
  COLUMN_GAP,
  EDGE_COLORS,
  NODE_HEIGHT,
  NODE_WIDTH,
  NODES_PER_ROW,
  PARALLEL_GROUP_THRESHOLD_MS,
  ROW_GAP,
  type FlowTheme,
} from "./flowChartConstants";

// 모든 도형/메모보다 한 단계 위(맨 앞) zIndex를 구한다. 비어 있으면 1.
export function getNextFrontZIndex(
  shapes: FlowShape[],
  notes: FlowTextNote[]
): number {
  const zIndexes = [
    ...shapes.map((shape) => shape.zIndex ?? 0),
    ...notes.map((note) => note.zIndex ?? 0),
  ];
  return zIndexes.length ? Math.max(...zIndexes) + 1 : 1;
}

export function toFlowNodes(
  items: TimelineItem[],
  requestById: Map<string, ApiRequest>,
  selectedRequestId: string | null,
  groupByTime: boolean,
  groups: TimelineItem[][],
  searchOccurrenceByRequest: Map<string, RequestSearchSummary>,
  activeGlobalSearchIndex: number | null,
  showQuery: boolean
): Node[] {
  return items.map((item, index) => {
    const request = requestById.get(item.requestId);
    const searchSummary = searchOccurrenceByRequest.get(item.requestId);
    const statusTone = getStatusTone(item.status);
    const query = showQuery ? getQueryString(request) : "";
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
      type: "requestNode",
      position,
      width: NODE_WIDTH,
      data: {
        requestId: item.requestId,
        label: (
          <div
            className={`flow-node ${
              selectedRequestId === item.requestId ? "selected" : ""
            }`}
          >
            <div className="flow-node-top">
              <div className="flow-node-top-main">
                <span className={`method method-${item.method.toLowerCase()}`}>
                  {item.method}
                </span>
                <span className={`flow-status ${statusTone}`}>
                  {item.status || "n/a"}
                </span>
              </div>
              {searchSummary ? (
                <SearchHitBadge
                  summary={searchSummary}
                  activeGlobalSearchIndex={activeGlobalSearchIndex}
                />
              ) : null}
            </div>
            {imageSource ? (
              <div className="flow-node-image-title">
                <ImagePreview src={imageSource} alt="Base64 request preview" />
                <strong title={item.path}>Image payload</strong>
              </div>
            ) : (
              <strong title={`${item.path}${query}`}>
                {getNodeTitle(item)}
                {query ? (
                  <span className="flow-node-query">{query}</span>
                ) : null}
              </strong>
            )}
            <div className="flow-node-summary">
              {bodySummary.map((summary) => (
                <span key={summary}>{summary}</span>
              ))}
            </div>
            <div className="flow-node-bottom">
              <span>{formatDateTime(request?.startedAt ?? NaN)}</span>
              <span className={item.isSlow ? "slow-text" : ""}>
                {formatDuration(request?.duration ?? item.duration)}
              </span>
            </div>
          </div>
        ),
      },
      style: {
        width: NODE_WIDTH,
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

// 요청 URL에서 쿼리 문자열(선행 '?' 포함)을 추출한다. 없으면 빈 문자열.
function getQueryString(request?: ApiRequest): string {
  if (!request) return "";
  try {
    return new URL(request.url).search;
  } catch {
    return "";
  }
}

export function toFlowEdges(
  items: TimelineItem[],
  groupByTime: boolean,
  groups: TimelineItem[][],
  theme: FlowTheme
): Edge[] {
  if (groupByTime) {
    return groups.slice(1).map((group, index) => {
      const previous = groups[index][groups[index].length - 1];
      const next = group[0];
      const isError = group.some((item) => item.isError);

      return createEdge(previous, next, isError, theme);
    });
  }

  return items.slice(1).map((item, index) => {
    const previous = items[index];
    return createEdge(previous, item, item.isError, theme);
  });
}

function createEdge(
  source: TimelineItem,
  target: TimelineItem,
  isError: boolean,
  theme: FlowTheme
): Edge {
  // 자동 연결선은 왼쪽→오른쪽 흐름에 맞춰 우측/좌측 핸들에 붙인다.
  return styledEdge(
    `${source.requestId}-${target.requestId}`,
    source.requestId,
    target.requestId,
    isError,
    theme,
    "right",
    "left"
  );
}

export function styledEdge(
  id: string,
  source: string,
  target: string,
  isError: boolean,
  theme: FlowTheme,
  sourceHandle?: string | null,
  targetHandle?: string | null
): Edge {
  const color = isError ? EDGE_COLORS[theme].error : EDGE_COLORS[theme].normal;

  return {
    id,
    source,
    target,
    sourceHandle: sourceHandle ?? null,
    targetHandle: targetHandle ?? null,
    type: "straight",
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color,
    },
    style: {
      stroke: color,
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
  groups: TimelineItem[][]
): { x: number; y: number } {
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const itemIndex = groups[groupIndex].findIndex(
      (candidate) => candidate.requestId === item.requestId
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

export function mergeNodePositions(
  manualPositions: Map<string, { x: number; y: number }>,
  autoPositions: Map<string, { x: number; y: number }>
): Map<string, { x: number; y: number }> {
  const merged = new Map(autoPositions);
  for (const [id, position] of manualPositions) {
    merged.set(id, position);
  }
  return merged;
}

export function getNextWrappedPosition(
  anchorPosition: { x: number; y: number },
  previousPosition: { x: number; y: number },
  existingNodes: Node[],
  positions: Map<string, { x: number; y: number }>
): { x: number; y: number } {
  const stepX = NODE_WIDTH + COLUMN_GAP;
  const stepY = NODE_HEIGHT + ROW_GAP;
  const occupiedPositions = existingNodes.map(
    (node) => positions.get(node.id) ?? node.position
  );

  const previousColumn = Math.max(
    0,
    Math.round((previousPosition.x - anchorPosition.x) / stepX)
  );
  const previousRow = Math.max(
    0,
    Math.round((previousPosition.y - anchorPosition.y) / stepY)
  );
  const previousIndex =
    previousRow * AUTO_CONTINUATION_COLUMNS + previousColumn;

  for (let offset = 1; offset < AUTO_CONTINUATION_COLUMNS * 20; offset += 1) {
    const nextIndex = previousIndex + offset;
    const candidate = {
      x: anchorPosition.x + (nextIndex % AUTO_CONTINUATION_COLUMNS) * stepX,
      y:
        anchorPosition.y +
        Math.floor(nextIndex / AUTO_CONTINUATION_COLUMNS) * stepY,
    };
    if (
      !occupiedPositions.some((position) =>
        positionsOverlap(candidate, position)
      )
    ) {
      return candidate;
    }
  }

  return {
    x: anchorPosition.x + stepX,
    y: anchorPosition.y,
  };
}

function positionsOverlap(
  first: { x: number; y: number },
  second: { x: number; y: number }
): boolean {
  return (
    Math.abs(first.x - second.x) < NODE_WIDTH &&
    Math.abs(first.y - second.y) < NODE_HEIGHT
  );
}

export function toTimeGroups(items: TimelineItem[]): TimelineItem[][] {
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
