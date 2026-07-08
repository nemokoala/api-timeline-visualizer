/**
 * Flow 차트의 레이아웃 치수·줌 한계·색상 팔레트·노드 id 접두사 상수.
 * FlowChartView와 노드 뷰/그래프 빌더가 함께 사용한다.
 */

export const NODE_WIDTH = 240;
export const NODE_HEIGHT = 152;
export const COLUMN_GAP = 45;
export const ROW_GAP = 55;
export const NODES_PER_ROW = 3;
export const AUTO_CONTINUATION_COLUMNS = 4;
export const PARALLEL_GROUP_THRESHOLD_MS = 120;
export const MIN_ZOOM = 0.12;
export const MAX_ZOOM = 1.6;
export const WHEEL_ZOOM_SENSITIVITY = 0.00065;

export const EDGE_COLORS = {
  light: { normal: "#b0b8c1", error: "#f04452", dot: "#d9dee3" },
  dark: { normal: "#4a4d57", error: "#ff6b70", dot: "#2f2f3a" },
} as const;

export type FlowTheme = keyof typeof EDGE_COLORS;

export const TEXT_NODE_PREFIX = "text-note-";
export const MANUAL_EDGE_PREFIX = "manual-edge-";
export const SHAPE_NODE_PREFIX = "shape-";

export const SHAPE_DEFAULT_WIDTH = 220;
export const SHAPE_DEFAULT_HEIGHT = 140;
export const SHAPE_MIN_SIZE = 60;

export const TEXT_NOTE_DEFAULT_WIDTH = 200;
export const TEXT_NOTE_DEFAULT_HEIGHT = 72;
export const TEXT_NOTE_MIN_WIDTH = 100;
export const TEXT_NOTE_MIN_HEIGHT = 48;
export const TEXT_NOTE_DEFAULT_FONT_SIZE = 12;
export const TEXT_NOTE_MIN_FONT_SIZE = 10;
export const TEXT_NOTE_MAX_FONT_SIZE = 36;
export const TEXT_NOTE_FONT_STEP = 2;

// 도형에 적용할 수 있는 색상 팔레트.
export const SHAPE_COLORS = [
  "#3182f6",
  "#f04452",
  "#00c389",
  "#f5a623",
  "#9b59f6",
  "#868b94",
] as const;
