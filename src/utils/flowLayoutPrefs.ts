/**
 * 플로우차트 사용자 편집을 localStorage에 저장합니다.
 * 텍스트 메모(notes)는 새로고침 자동 복원 대상에서 제외하고,
 * 세션 JSON export/import에만 포함합니다.
 */
import { readJson, writeJson, removeKey } from './localStoragePrefs';

const FLOW_LAYOUT_KEY = 'api-flow-layout';

export type FlowNotePosition = { x: number; y: number };

export type FlowTextNote = {
  id: string;
  position: FlowNotePosition;
  text: string;
  /** 글자 색(CSS 색). 없으면 기본 텍스트색. */
  color?: string;
  /** false면 배경/테두리를 없애고 글자만 띄운다. 기본 true. */
  background?: boolean;
  /** 노드 쌓임 순서. 없으면 0. */
  zIndex?: number;
  /** 메모 박스 크기(px). 없으면 기본값. */
  width?: number;
  height?: number;
  /** 글자 크기(px). 없으면 기본값. */
  fontSize?: number;
};

export type FlowManualEdge = {
  id: string;
  source: string;
  target: string;
  /** 어느 핸들(상/하/좌/우)에 연결됐는지. 없으면 기본 핸들. */
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

export type FlowShape = {
  id: string;
  position: FlowNotePosition;
  width: number;
  height: number;
  /** 테두리/채움에 사용할 색상(CSS 색). */
  color: string;
  /** true면 색을 채우고, false면 테두리만 남긴다. */
  filled: boolean;
  /** 노드 쌓임 순서. 없으면 0. */
  zIndex?: number;
};

export type FlowLayout = {
  positions: Record<string, FlowNotePosition>;
  deleted: string[];
  notes: FlowTextNote[];
  /** 사용자가 삭제한 자동 연결선의 id 목록. */
  deletedEdges: string[];
  /** 사용자가 수동으로 추가한 연결선. */
  manualEdges: FlowManualEdge[];
  /** 사용자가 추가한 도형(사각형 등). */
  shapes: FlowShape[];
};

export const EMPTY_FLOW_LAYOUT: FlowLayout = {
  positions: {},
  deleted: [],
  notes: [],
  deletedEdges: [],
  manualEdges: [],
  shapes: [],
};

export function isEmptyFlowLayout(layout: FlowLayout): boolean {
  return (
    Object.keys(layout.positions).length === 0 &&
    layout.deleted.length === 0 &&
    layout.notes.length === 0 &&
    layout.deletedEdges.length === 0 &&
    layout.manualEdges.length === 0 &&
    layout.shapes.length === 0
  );
}

function isPosition(value: unknown): value is FlowNotePosition {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FlowNotePosition>;
  return (
    typeof candidate.x === 'number' &&
    Number.isFinite(candidate.x) &&
    typeof candidate.y === 'number' &&
    Number.isFinite(candidate.y)
  );
}

/** 신뢰할 수 없는 입력(import한 JSON 포함)을 안전한 FlowLayout으로 정규화합니다. */
export function normalizeFlowLayout(value: unknown): FlowLayout {
  if (!value || typeof value !== 'object') return { ...EMPTY_FLOW_LAYOUT };
  const candidate = value as Partial<FlowLayout>;

  const positions: Record<string, FlowNotePosition> = {};
  if (candidate.positions && typeof candidate.positions === 'object') {
    for (const [id, position] of Object.entries(candidate.positions)) {
      if (isPosition(position)) positions[id] = { x: position.x, y: position.y };
    }
  }

  const deleted = Array.isArray(candidate.deleted)
    ? candidate.deleted.filter((id): id is string => typeof id === 'string')
    : [];

  const notes = Array.isArray(candidate.notes)
    ? candidate.notes
        .filter(
          (note): note is FlowTextNote =>
            Boolean(note) &&
            typeof note === 'object' &&
            typeof (note as FlowTextNote).id === 'string' &&
            typeof (note as FlowTextNote).text === 'string' &&
            isPosition((note as FlowTextNote).position),
        )
        .map((note) => ({
          id: note.id,
          position: { x: note.position.x, y: note.position.y },
          text: note.text,
          ...(typeof note.color === 'string' ? { color: note.color } : {}),
          ...(typeof note.background === 'boolean'
            ? { background: note.background }
            : {}),
          ...(typeof note.zIndex === 'number' && Number.isFinite(note.zIndex)
            ? { zIndex: note.zIndex }
            : {}),
          ...(typeof note.width === 'number' && Number.isFinite(note.width)
            ? { width: note.width }
            : {}),
          ...(typeof note.height === 'number' && Number.isFinite(note.height)
            ? { height: note.height }
            : {}),
          ...(typeof note.fontSize === 'number' && Number.isFinite(note.fontSize)
            ? { fontSize: note.fontSize }
            : {}),
        }))
    : [];

  const deletedEdges = Array.isArray(candidate.deletedEdges)
    ? candidate.deletedEdges.filter((id): id is string => typeof id === 'string')
    : [];

  const manualEdges = Array.isArray(candidate.manualEdges)
    ? candidate.manualEdges
        .filter(
          (edge): edge is FlowManualEdge =>
            Boolean(edge) &&
            typeof edge === 'object' &&
            typeof (edge as FlowManualEdge).id === 'string' &&
            typeof (edge as FlowManualEdge).source === 'string' &&
            typeof (edge as FlowManualEdge).target === 'string',
        )
        .map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle:
            typeof edge.sourceHandle === 'string' ? edge.sourceHandle : null,
          targetHandle:
            typeof edge.targetHandle === 'string' ? edge.targetHandle : null,
        }))
    : [];

  const shapes = Array.isArray(candidate.shapes)
    ? candidate.shapes
        .filter(
          (shape): shape is FlowShape =>
            Boolean(shape) &&
            typeof shape === 'object' &&
            typeof (shape as FlowShape).id === 'string' &&
            isPosition((shape as FlowShape).position) &&
            typeof (shape as FlowShape).width === 'number' &&
            Number.isFinite((shape as FlowShape).width) &&
            typeof (shape as FlowShape).height === 'number' &&
            Number.isFinite((shape as FlowShape).height) &&
            typeof (shape as FlowShape).color === 'string' &&
            typeof (shape as FlowShape).filled === 'boolean',
        )
        .map((shape) => ({
          id: shape.id,
          position: { x: shape.position.x, y: shape.position.y },
          width: shape.width,
          height: shape.height,
          color: shape.color,
          filled: shape.filled,
          ...(typeof shape.zIndex === 'number' && Number.isFinite(shape.zIndex)
            ? { zIndex: shape.zIndex }
            : {}),
        }))
    : [];

  return { positions, deleted, notes, deletedEdges, manualEdges, shapes };
}

export function loadFlowLayout(): FlowLayout {
  const stored = readJson<unknown>(FLOW_LAYOUT_KEY);
  if (stored === null) return { ...EMPTY_FLOW_LAYOUT };
  return { ...normalizeFlowLayout(stored), notes: [], shapes: [] };
}

export function saveFlowLayout(layout: FlowLayout): void {
  const storedLayout: FlowLayout = { ...layout, notes: [], shapes: [] };
  if (isEmptyFlowLayout(storedLayout)) {
    removeKey(FLOW_LAYOUT_KEY);
    return;
  }
  writeJson(FLOW_LAYOUT_KEY, storedLayout);
}
