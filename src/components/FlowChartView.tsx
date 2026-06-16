import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type WheelEvent,
} from "react";
import {
  Background,
  ConnectionMode,
  Controls,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  SelectionMode,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import type { ReactFlowInstance } from "@xyflow/react";
import type { ApiRequest, TimelineItem } from "../types/network";
import { useTheme } from "../hooks/useTheme";
import { exportFlowChartToPng } from "../utils/exportFlowImage";
import { getImageSource } from "../utils/imageSource";
import {
  saveFlowLayout,
  type FlowLayout,
  type FlowManualEdge,
  type FlowTextNote,
} from "../utils/flowLayoutPrefs";
import { getFlowShowQuery, saveFlowShowQuery } from "../utils/networkFlowPrefs";
import type { RequestSearchSummary } from "../utils/requestSearch";
import { formatDuration, formatOffset, getStatusTone } from "./formatters";
import { ImagePreview } from "./ImagePreview";
import { SearchHitBadge } from "./SearchHitBadge";

type FlowChartViewProps = {
  items: TimelineItem[];
  requests: ApiRequest[];
  selectedRequestId: string | null;
  groupByTime: boolean;
  searchText: string;
  searchOccurrenceByRequest: Map<string, RequestSearchSummary>;
  activeGlobalSearchIndex: number | null;
  // import 등으로 외부에서 레이아웃을 갈아끼웠을 때 localStorage에서 다시 읽어오기 위한 신호.
  layoutRevision: number;
  layoutSnapshot: FlowLayout;
  onSelectRequest: (requestId: string) => void;
  onLayoutChange: (layout: FlowLayout) => void;
};

const NODE_WIDTH = 240;
const NODE_HEIGHT = 152;
const COLUMN_GAP = 40;
const ROW_GAP = 42;
const NODES_PER_ROW = 3;
const AUTO_CONTINUATION_COLUMNS = 4;
const PARALLEL_GROUP_THRESHOLD_MS = 120;
const MIN_ZOOM = 0.12;
const MAX_ZOOM = 1.6;
const WHEEL_ZOOM_SENSITIVITY = 0.00065;

const EDGE_COLORS = {
  light: { normal: "#b0b8c1", error: "#f04452", dot: "#d9dee3" },
  dark: { normal: "#4a4d57", error: "#ff6b70", dot: "#2f2f3a" },
} as const;

const TEXT_NODE_PREFIX = "text-note-";
const MANUAL_EDGE_PREFIX = "manual-edge-";

type TextNoteData = {
  text: string;
  onTextChange: (id: string, text: string) => void;
};

type RequestNodeData = {
  requestId: string;
  label: ReactNode;
};

// 상/하/좌/우 네 방향 핸들. loose 모드라 각 핸들이 연결 시작/끝 모두 가능하다.
const HANDLE_SIDES = [
  { id: "top", position: Position.Top },
  { id: "right", position: Position.Right },
  { id: "bottom", position: Position.Bottom },
  { id: "left", position: Position.Left },
] as const;

// API 요청 카드 노드. 라벨 + 사방 연결 핸들을 렌더한다.
function RequestNodeView({ data }: NodeProps) {
  const nodeData = data as RequestNodeData;
  return (
    <>
      {HANDLE_SIDES.map((side) => (
        <Handle
          key={side.id}
          type="source"
          id={side.id}
          position={side.position}
        />
      ))}
      {nodeData.label}
    </>
  );
}

// 사용자가 자유롭게 메모를 적을 수 있는 커스텀 텍스트 노드.
function TextNoteNodeView({ id, data }: NodeProps) {
  const noteData = data as TextNoteData;
  // textarea를 로컬 상태로 제어한다. 부모 리렌더가 입력값을 되돌려 적용하지
  // 않으므로 한글 IME 조합 중 자모가 분리되지 않는다.
  const [value, setValue] = useState(noteData.text);
  const isInitialEmpty = useRef(noteData.text === "");

  // import/reset 등 외부에서 텍스트가 바뀌면 로컬 값도 맞춘다.
  // 타이핑 중에는 noteData.text가 로컬 value와 같아 no-op이 된다.
  useEffect(() => {
    setValue(noteData.text);
  }, [noteData.text]);

  return (
    <div className="flow-text-note">
      <textarea
        className="nodrag flow-text-note-input"
        value={value}
        placeholder="메모 입력..."
        rows={2}
        autoFocus={isInitialEmpty.current}
        onChange={(event) => {
          setValue(event.target.value);
          noteData.onTextChange(id, event.target.value);
        }}
        onPointerDown={(event) => event.stopPropagation()}
        // 입력 중 키 입력이 React Flow(삭제 단축키 등)로 전파되지 않도록 막는다.
        onKeyDown={(event) => event.stopPropagation()}
      />
    </div>
  );
}

const NODE_TYPES: NodeTypes = {
  requestNode: RequestNodeView,
  textNote: TextNoteNodeView,
};

export function FlowChartView({
  items,
  requests,
  selectedRequestId,
  groupByTime,
  searchText,
  searchOccurrenceByRequest,
  activeGlobalSearchIndex,
  layoutRevision,
  layoutSnapshot,
  onSelectRequest,
  onLayoutChange,
}: FlowChartViewProps) {
  const flowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const flowPanelRef = useRef<HTMLElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  // 사용자가 직접 옮긴 위치, 삭제한 노드, 추가한 텍스트 메모를 로컬 상태로 보관한다.
  // 텍스트 메모는 localStorage가 아니라 import/export용 스냅샷에서만 복원한다.
  const [positionOverrides, setPositionOverrides] = useState<
    Map<string, { x: number; y: number }>
  >(() => new Map(Object.entries(layoutSnapshot.positions)));
  const [deletedIds, setDeletedIds] = useState<Set<string>>(
    () => new Set(layoutSnapshot.deleted)
  );
  const [textNotes, setTextNotes] = useState<FlowTextNote[]>(
    () => layoutSnapshot.notes
  );
  // 삭제한 자동 연결선 id, 수동으로 추가한 연결선.
  const [deletedEdgeIds, setDeletedEdgeIds] = useState<Set<string>>(
    () => new Set(layoutSnapshot.deletedEdges)
  );
  const [manualEdges, setManualEdges] = useState<FlowManualEdge[]>(
    () => layoutSnapshot.manualEdges
  );
  // 카드 타이틀에 쿼리 문자열 표시 여부(localStorage에 저장).
  const [showQuery, setShowQuery] = useState(() => getFlowShowQuery());
  useEffect(() => {
    saveFlowShowQuery(showQuery);
  }, [showQuery]);
  const { theme } = useTheme();
  // React Flow가 노드 상태를 직접 소유한다. 드래그 중에는 applyNodeChanges로
  // 움직이는 노드의 위치만 갱신되어 다른 노드/엣지의 내부 측정값이 보존되고,
  // 그래서 선이 깜빡이지 않는다. 우리의 영속 상태(positionOverrides 등)에는
  // 드래그가 끝났을 때만 위치를 커밋한다.
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);
  // 동기화 effect가 positionOverrides 변경마다 재실행되지 않도록 ref로 최신값을 읽는다.
  const positionOverridesRef = useRef(positionOverrides);
  positionOverridesRef.current = positionOverrides;
  // 현재 표시 중인 연결선(중복 연결 방지에 사용).
  const rfEdgesRef = useRef(rfEdges);
  rfEdgesRef.current = rfEdges;
  // 동기화 effect가 텍스트 한 글자마다 재실행되지 않도록 메모 최신값을 ref로 읽는다.
  const textNotesRef = useRef(textNotes);
  textNotesRef.current = textNotes;
  const [autoPositions, setAutoPositions] = useState<
    Map<string, { x: number; y: number }>
  >(new Map());
  // 새로 들어온 요청만 위치를 한 번 부여한다. 기존 요청을 다시 줄 세우지 않는다.
  const knownRequestNodeIdsRef = useRef<Set<string>>(new Set());

  const requestById = useMemo(
    () => new Map(requests.map((request) => [request.id, request])),
    [requests]
  );
  const groups = useMemo(
    () => (groupByTime ? toTimeGroups(items) : []),
    [items, groupByTime]
  );

  const handleTextChange = useCallback(
    (id: string, text: string) => {
      // 영속 상태 갱신(저장용).
      setTextNotes((prev) =>
        prev.map((note) => (note.id === id ? { ...note, text } : note))
      );
      // React Flow 노드 data를 제자리에서 갱신한다. 전체 재생성을 피해
      // textarea가 리마운트되지 않으므로 입력 중 포커스가 유지된다.
      setRfNodes((nodes) =>
        nodes.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, text } } : node
        )
      );
    },
    [setRfNodes]
  );

  // 편집이 바뀔 때마다 위치/삭제/수동 연결선은 localStorage에 저장한다.
  // 텍스트 메모는 onLayoutChange를 통해 export/import 스냅샷에만 유지한다.
  // positionOverrides는 드래그가 끝났을 때만 갱신되므로 매 프레임 저장되지 않는다.
  useEffect(() => {
    const layout = {
      positions: Object.fromEntries(positionOverrides),
      deleted: [...deletedIds],
      notes: textNotes,
      deletedEdges: [...deletedEdgeIds],
      manualEdges,
    };
    saveFlowLayout(layout);
    onLayoutChange(layout);
  }, [
    positionOverrides,
    deletedIds,
    textNotes,
    deletedEdgeIds,
    manualEdges,
    onLayoutChange,
  ]);

  // 세션 import 등 외부에서 레이아웃이 교체되면 저장소에서 다시 읽어 상태에 반영.
  useEffect(() => {
    setPositionOverrides(new Map(Object.entries(layoutSnapshot.positions)));
    setDeletedIds(new Set(layoutSnapshot.deleted));
    setTextNotes(layoutSnapshot.notes);
    setDeletedEdgeIds(new Set(layoutSnapshot.deletedEdges));
    setManualEdges(layoutSnapshot.manualEdges);
  }, [layoutRevision]);

  // 노드 라벨(JSX)과 엣지는 드래그(위치 변경)와 무관한 입력에만 의존하도록 메모이즈한다.
  // 이렇게 해야 드래그 중에 data/엣지 객체의 참조가 유지되어 React Flow가 재렌더하지 않는다.
  const baseNodes = useMemo(
    () =>
      toFlowNodes(
        items,
        requestById,
        selectedRequestId,
        groupByTime,
        groups,
        searchOccurrenceByRequest,
        activeGlobalSearchIndex,
        showQuery
      ),
    [
      items,
      requestById,
      selectedRequestId,
      groupByTime,
      groups,
      searchOccurrenceByRequest,
      activeGlobalSearchIndex,
      showQuery,
    ]
  );
  const baseEdges = useMemo(
    () => toFlowEdges(items, groupByTime, groups, theme),
    [items, groupByTime, groups, theme]
  );

  useEffect(() => {
    knownRequestNodeIdsRef.current = new Set(baseNodes.map((node) => node.id));
    setAutoPositions(new Map());
  }, [layoutRevision]);

  useEffect(() => {
    const knownIds = knownRequestNodeIdsRef.current;
    if (baseNodes.length === 0) {
      knownIds.clear();
      setAutoPositions(new Map());
      return;
    }

    if (positionOverrides.size === 0) {
      setAutoPositions(new Map());
      baseNodes.forEach((node) => knownIds.add(node.id));
      return;
    }

    if (knownIds.size === 0) {
      baseNodes.forEach((node) => knownIds.add(node.id));
      return;
    }

    const visibleNodes = baseNodes.filter((node) => !deletedIds.has(node.id));
    const newNodes = visibleNodes.filter(
      (node) => !knownIds.has(node.id) && !positionOverrides.has(node.id)
    );
    baseNodes.forEach((node) => knownIds.add(node.id));
    if (newNodes.length === 0) return;

    setAutoPositions((prev) => {
      let changed = false;
      const next = new Map(prev);
      const positions = mergeNodePositions(positionOverrides, next);

      for (const node of newNodes) {
        if (positions.has(node.id)) continue;

        const nodeIndex = visibleNodes.findIndex(
          (candidate) => candidate.id === node.id
        );
        const previousNode = nodeIndex > 0 ? visibleNodes[nodeIndex - 1] : null;
        if (!previousNode) continue;

        const anchorNode =
          visibleNodes
            .slice(0, nodeIndex)
            .reverse()
            .find((candidate) => positionOverrides.has(candidate.id)) ??
          previousNode;
        const previousPosition =
          positions.get(previousNode.id) ?? previousNode.position;
        const anchorPosition =
          positions.get(anchorNode.id) ?? anchorNode.position;

        const nextPosition = getNextWrappedPosition(
          anchorPosition,
          previousPosition,
          visibleNodes.slice(0, nodeIndex),
          positions
        );
        next.set(node.id, nextPosition);
        positions.set(node.id, nextPosition);
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [baseNodes, deletedIds, positionOverrides]);

  // 텍스트 메모 노드의 data는 텍스트가 바뀔 때만 새로 만든다(위치 이동과 분리).
  // 메모의 추가/삭제(구조 변화)만 감지하는 키. 텍스트 내용이 바뀌어도 동일하다.
  // → 타이핑 중에는 아래 동기화 effect가 재실행되지 않아 노드가 재생성되지 않는다.
  const noteIdsKey = useMemo(
    () => textNotes.map((note) => note.id).join("|"),
    [textNotes]
  );

  // 삭제/노드 라벨/메모 추가·삭제 시에만 React Flow 노드 상태를 다시 만든다.
  // positionOverrides·텍스트 내용은 의존성에 넣지 않고 ref로 읽어, 불필요한
  // 전체 재생성(과 그로 인한 포커스 손실/깜빡임)을 피한다.
  useEffect(() => {
    const overrides = positionOverridesRef.current;
    const requestPositions = mergeNodePositions(overrides, autoPositions);
    const nextNodes: Node[] = [
      ...baseNodes
        .filter((node) => !deletedIds.has(node.id))
        .map((node) => ({
          ...node,
          position: requestPositions.get(node.id) ?? node.position,
          draggable: true,
        })),
      ...textNotesRef.current.map<Node>((note) => ({
        id: note.id,
        type: "textNote",
        position: overrides.get(note.id) ?? note.position,
        draggable: true,
        data: { text: note.text, onTextChange: handleTextChange },
      })),
    ];
    // 재생성 시 React Flow가 추적하던 선택 상태를 유지한다(Delete 키 대상 보존).
    setRfNodes((prev) => {
      const selectedIds = new Set(
        prev.filter((node) => node.selected).map((node) => node.id)
      );
      if (selectedIds.size === 0) return nextNodes;
      return nextNodes.map((node) =>
        selectedIds.has(node.id) ? { ...node, selected: true } : node
      );
    });
  }, [
    baseNodes,
    autoPositions,
    deletedIds,
    noteIdsKey,
    handleTextChange,
    setRfNodes,
  ]);

  // 표시할 연결선 = (자동 연결선 − 삭제한 노드/연결선) + 수동 연결선.
  // 노드와 동일하게 React Flow가 상태를 소유하고, 삭제/연결은 onEdgesChange/onConnect로 처리한다.
  useEffect(() => {
    const isNodeVisible = (id: string) => !deletedIds.has(id);
    const visibleAuto = baseEdges.filter(
      (edge) =>
        isNodeVisible(edge.source) &&
        isNodeVisible(edge.target) &&
        !deletedEdgeIds.has(edge.id)
    );
    const manual = manualEdges
      .filter(
        (edge) => isNodeVisible(edge.source) && isNodeVisible(edge.target)
      )
      .map((edge) =>
        styledEdge(
          edge.id,
          edge.source,
          edge.target,
          false,
          theme,
          // 핸들 정보가 없는(예전) 연결선은 우측/좌측 핸들로 폴백.
          edge.sourceHandle ?? "right",
          edge.targetHandle ?? "left"
        )
      );
    const nextEdges = [...visibleAuto, ...manual];

    // 재생성 시 선택 상태 유지(Delete 키 대상 보존).
    setRfEdges((prev) => {
      const selectedIds = new Set(
        prev.filter((edge) => edge.selected).map((edge) => edge.id)
      );
      if (selectedIds.size === 0) return nextEdges;
      return nextEdges.map((edge) =>
        selectedIds.has(edge.id) ? { ...edge, selected: true } : edge
      );
    });
  }, [baseEdges, deletedIds, deletedEdgeIds, manualEdges, theme, setRfEdges]);

  const hasEdits =
    positionOverrides.size > 0 ||
    deletedIds.size > 0 ||
    textNotes.length > 0 ||
    deletedEdgeIds.size > 0 ||
    manualEdges.length > 0;

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // 라이브 반영: 드래그 중 움직이는 노드 위치만 갱신(내부 측정값 보존).
      onNodesChange(changes);

      // 드래그가 끝난(dragging !== true) 위치 변경만 영속 상태에 커밋한다.
      const committed = changes.filter(
        (change): change is Extract<NodeChange, { type: "position" }> =>
          change.type === "position" &&
          Boolean(change.position) &&
          change.dragging !== true
      );
      const removedIds = changes
        .filter(
          (change): change is Extract<NodeChange, { type: "remove" }> =>
            change.type === "remove"
        )
        .map((change) => change.id);

      if (committed.length) {
        setPositionOverrides((prev) => {
          const next = new Map(prev);
          for (const change of committed) {
            if (change.position) next.set(change.id, change.position);
          }
          return next;
        });
        setAutoPositions((prev) => {
          let changed = false;
          const next = new Map(prev);
          for (const change of committed) {
            if (next.delete(change.id)) changed = true;
          }
          return changed ? next : prev;
        });
      }

      if (removedIds.length) {
        setAutoPositions((prev) => {
          let changed = false;
          const next = new Map(prev);
          for (const id of removedIds) {
            if (next.delete(id)) changed = true;
          }
          return changed ? next : prev;
        });
        setTextNotes((prev) =>
          prev.filter((note) => !removedIds.includes(note.id))
        );
        setDeletedIds((prev) => {
          const next = new Set(prev);
          for (const id of removedIds) {
            if (!id.startsWith(TEXT_NODE_PREFIX)) next.add(id);
          }
          return next;
        });
      }
    },
    [onNodesChange]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // 라이브 반영(선택 등). 삭제는 영속 상태에도 기록한다.
      onEdgesChange(changes);

      const removedIds = changes
        .filter(
          (change): change is Extract<EdgeChange, { type: "remove" }> =>
            change.type === "remove"
        )
        .map((change) => change.id);

      if (removedIds.length) {
        setManualEdges((prev) =>
          prev.filter((edge) => !removedIds.includes(edge.id))
        );
        setDeletedEdgeIds((prev) => {
          const next = new Set(prev);
          for (const id of removedIds) {
            if (!id.startsWith(MANUAL_EDGE_PREFIX)) next.add(id);
          }
          return next;
        });
      }
    },
    [onEdgesChange]
  );

  // 핸들에서 다른 노드로 끌어 놓으면 수동 연결선을 추가한다.
  const handleConnect = useCallback((connection: Connection) => {
    const { source, target, sourceHandle, targetHandle } = connection;
    if (!source || !target || source === target) return;
    // 같은 두 노드를 같은 핸들로 잇는 연결선이 이미 있으면 중복 추가하지 않는다.
    const alreadyConnected = rfEdgesRef.current.some(
      (edge) =>
        edge.source === source &&
        edge.target === target &&
        (edge.sourceHandle ?? null) === (sourceHandle ?? null) &&
        (edge.targetHandle ?? null) === (targetHandle ?? null)
    );
    if (alreadyConnected) return;
    const id = `${MANUAL_EDGE_PREFIX}${source}.${
      sourceHandle ?? ""
    }__${target}.${targetHandle ?? ""}`;
    setManualEdges((prev) => {
      if (prev.some((edge) => edge.id === id)) return prev;
      return [...prev, { id, source, target, sourceHandle, targetHandle }];
    });
  }, []);

  const handleAddTextNote = useCallback(() => {
    const instance = flowInstanceRef.current;
    const panel = flowPanelRef.current;
    let position = { x: 0, y: 0 };
    if (instance && panel) {
      const rect = panel.getBoundingClientRect();
      position = instance.screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }
    const id = `${TEXT_NODE_PREFIX}${Date.now()}`;
    setTextNotes((prev) => [...prev, { id, position, text: "" }]);
  }, []);

  const handleResetLayout = useCallback(() => {
    setPositionOverrides(new Map());
    setDeletedIds(new Set());
    setTextNotes([]);
    setDeletedEdgeIds(new Set());
    setManualEdges([]);
  }, []);

  useEffect(() => {
    if (!searchText.trim() || !selectedRequestId) return;

    const flowInstance = flowInstanceRef.current;
    if (!flowInstance) return;

    flowInstance.fitView({
      nodes: [{ id: selectedRequestId }],
      padding: 0.24,
      duration: 220,
      maxZoom: 1.2,
    });
  }, [searchText, selectedRequestId]);
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
      MAX_ZOOM
    );

    flowInstance.setViewport(
      {
        x: pointerX - flowX * nextZoom,
        y: pointerY - flowY * nextZoom,
        zoom: nextZoom,
      },
      { duration: 80 }
    );
  }, []);

  const handleDownloadImage = useCallback(async () => {
    const flowInstance = flowInstanceRef.current;
    const panel = flowPanelRef.current;
    if (!flowInstance || !panel || items.length === 0 || isExporting) return;

    const viewportElement = panel.querySelector(".react-flow__viewport");
    if (!(viewportElement instanceof HTMLElement)) return;

    setIsExporting(true);
    setExportError(null);
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      await exportFlowChartToPng(
        viewportElement,
        flowInstance.getNodes(),
        `api-flow-${timestamp}.png`
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to export image.";
      setExportError(message);
      console.error("Failed to export flow chart image", error);
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, items.length]);

  return (
    <section
      ref={flowPanelRef}
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
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={NODE_TYPES}
            fitView
            fitViewOptions={{ padding: 0.12 }}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            nodesDraggable
            nodesConnectable
            connectionMode={ConnectionMode.Loose}
            deleteKeyCode={["Delete"]}
            // 빈 캔버스를 좌클릭 드래그하면 여러 요소를 박스로 선택한다.
            // 패닝은 가운데/오른쪽 버튼 드래그 또는 Space+드래그로 한다.
            selectionOnDrag
            selectionMode={SelectionMode.Partial}
            panOnDrag={[1, 2]}
            panActivationKeyCode="Space"
            multiSelectionKeyCode={["Meta", "Shift", "Control"]}
            panOnScroll={false}
            zoomOnScroll={false}
            zoomOnPinch
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={handleConnect}
            onInit={(instance) => {
              flowInstanceRef.current = instance;
            }}
            onNodeClick={(_, node) => {
              if (node.data.requestId) {
                onSelectRequest(String(node.data.requestId));
              }
            }}
          >
            <Background color={EDGE_COLORS[theme].dot} gap={22} />
            <Controls showInteractive={false} />
            <Panel position="top-right" className="flow-export-panel">
              <div className="flow-export-controls">
                <div className="flow-export-buttons">
                  <button
                    className={`flow-export-button ${
                      showQuery ? "active" : ""
                    }`}
                    type="button"
                    aria-pressed={showQuery}
                    title="카드 타이틀에 쿼리 문자열 표시"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowQuery((value) => !value);
                    }}
                  >
                    {showQuery ? "Query ✓" : "Query"}
                  </button>
                  <button
                    className="flow-export-button"
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleAddTextNote();
                    }}
                  >
                    Add text
                  </button>
                  {hasEdits ? (
                    <button
                      className="flow-export-button"
                      type="button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleResetLayout();
                      }}
                    >
                      Reset
                    </button>
                  ) : null}
                  <button
                    className="flow-export-button"
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleDownloadImage();
                    }}
                    disabled={isExporting}
                  >
                    {isExporting ? "Exporting..." : "Download PNG"}
                  </button>
                </div>
                {exportError ? (
                  <span className="flow-export-error">{exportError}</span>
                ) : null}
              </div>
            </Panel>
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

function toFlowEdges(
  items: TimelineItem[],
  groupByTime: boolean,
  groups: TimelineItem[][],
  theme: keyof typeof EDGE_COLORS
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
  theme: keyof typeof EDGE_COLORS
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

function styledEdge(
  id: string,
  source: string,
  target: string,
  isError: boolean,
  theme: keyof typeof EDGE_COLORS,
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

function mergeNodePositions(
  manualPositions: Map<string, { x: number; y: number }>,
  autoPositions: Map<string, { x: number; y: number }>
): Map<string, { x: number; y: number }> {
  const merged = new Map(autoPositions);
  for (const [id, position] of manualPositions) {
    merged.set(id, position);
  }
  return merged;
}

function getNextWrappedPosition(
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
