import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type WheelEvent,
} from "react";
import {
  Background,
  ConnectionMode,
  Controls,
  Panel,
  ReactFlow,
  SelectionMode,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import type { ReactFlowInstance } from "@xyflow/react";
import type { ApiRequest, TimelineItem } from "../../types/network";
import { useTheme } from "../../hooks/useTheme";
import { usePersistedState } from "../../hooks/usePersistedState";
import { exportFlowChartToPng } from "../../utils/exportFlowImage";
import {
  type FlowLayout,
  type FlowManualEdge,
  type FlowShape,
  type FlowTextNote,
} from "../../utils/flowLayoutPrefs";
import { getFlowShowQuery, saveFlowShowQuery } from "../../utils/networkFlowPrefs";
import type { RequestSearchSummary } from "../../utils/requestSearch";
import { Button, IconButton } from "../ui/Button";
import { ResetIcon, SquareIcon, TextIcon } from "./FlowChartIcons";
import { NODE_TYPES } from "./FlowChartNodes";
import { EmptyState } from "../ui/EmptyState";
import {
  EDGE_COLORS,
  MANUAL_EDGE_PREFIX,
  MAX_ZOOM,
  MIN_ZOOM,
  SHAPE_COLORS,
  SHAPE_DEFAULT_HEIGHT,
  SHAPE_DEFAULT_WIDTH,
  SHAPE_NODE_PREFIX,
  TEXT_NODE_PREFIX,
  TEXT_NOTE_DEFAULT_FONT_SIZE,
  TEXT_NOTE_DEFAULT_HEIGHT,
  TEXT_NOTE_DEFAULT_WIDTH,
  WHEEL_ZOOM_SENSITIVITY,
} from "./flowChartConstants";
import {
  getNextFrontZIndex,
  getNextWrappedPosition,
  mergeNodePositions,
  styledEdge,
  toFlowEdges,
  toFlowNodes,
  toTimeGroups,
} from "./flowChartGraph";

type FlowChartViewProps = {
  items: TimelineItem[];
  requests: ApiRequest[];
  selectedRequestId: string | null;
  groupByTime: boolean;
  /** 경로의 ID·날짜·해시를 `:id` 등으로 접어 표시할지. */
  collapsePathIds: boolean;
  searchText: string;
  searchOccurrenceByRequest: Map<string, RequestSearchSummary>;
  activeGlobalSearchIndex: number | null;
  // import 등으로 외부에서 레이아웃을 갈아끼웠을 때 localStorage에서 다시 읽어오기 위한 신호.
  layoutRevision: number;
  layoutSnapshot: FlowLayout;
  onSelectRequest: (requestId: string) => void;
  onLayoutChange: (layout: FlowLayout) => void;
};

export function FlowChartView({
  items,
  requests,
  selectedRequestId,
  groupByTime,
  collapsePathIds,
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
  // dockview가 저장된 레이아웃을 복원하는 동안 패널이 0×0으로 마운트될 수 있다.
  // 그 상태에서 ReactFlow를 마운트하면 크기 측정마다 "parent container needs a
  // width and a height" 경고가 반복되므로, 실측 크기가 생긴 뒤에만 마운트한다.
  const [hasMeasuredSize, setHasMeasuredSize] = useState(false);
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
  const [shapes, setShapes] = useState<FlowShape[]>(() => layoutSnapshot.shapes);
  // 삭제한 자동 연결선 id, 수동으로 추가한 연결선.
  const [deletedEdgeIds, setDeletedEdgeIds] = useState<Set<string>>(
    () => new Set(layoutSnapshot.deletedEdges)
  );
  const [manualEdges, setManualEdges] = useState<FlowManualEdge[]>(
    () => layoutSnapshot.manualEdges
  );
  // 카드 타이틀에 쿼리 문자열 표시 여부(localStorage에 저장).
  const [showQuery, setShowQuery] = usePersistedState(getFlowShowQuery, saveFlowShowQuery);
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
  // 현재 노드(선택 상태 포함). 단축키 복사 시 선택된 노드를 읽는 데 쓴다.
  const rfNodesRef = useRef(rfNodes);
  rfNodesRef.current = rfNodes;
  // 동기화 effect가 텍스트 한 글자마다 재실행되지 않도록 메모 최신값을 ref로 읽는다.
  const textNotesRef = useRef(textNotes);
  textNotesRef.current = textNotes;
  // 도형 동기화 effect가 색/크기 변경마다 재실행되지 않도록 ref로 최신값을 읽는다.
  const shapesRef = useRef(shapes);
  shapesRef.current = shapes;
  const [autoPositions, setAutoPositions] = useState<
    Map<string, { x: number; y: number }>
  >(new Map());
  // 새로 들어온 요청만 위치를 한 번 부여한다. 기존 요청을 다시 줄 세우지 않는다.
  const knownRequestNodeIdsRef = useRef<Set<string>>(new Set());

  // 컨테이너가 실제 크기를 가질 때까지 ResizeObserver로 기다린다. 한 번 크기가
  // 잡히면 계속 마운트 상태를 유지해 뷰포트(줌/팬)를 잃지 않는다.
  useEffect(() => {
    const panel = flowPanelRef.current;
    if (!panel) return;

    const checkSize = () => {
      // border를 제외한 콘텐츠 크기 기준. getBoundingClientRect는 border 1px만
      // 있어도 높이가 1로 잡혀 0 크기 콘텐츠를 통과시킬 수 있다.
      if (panel.clientWidth > 0 && panel.clientHeight > 0) {
        setHasMeasuredSize(true);
      }
    };
    checkSize();

    const observer = new ResizeObserver(checkSize);
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

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

  const handleShapeChange = useCallback(
    (id: string, patch: Partial<Pick<FlowShape, "color" | "filled">>) => {
      // 영속 상태 갱신(저장용).
      setShapes((prev) =>
        prev.map((shape) => (shape.id === id ? { ...shape, ...patch } : shape))
      );
      // React Flow 노드 data를 제자리에서 갱신해 노드 재생성을 피한다.
      setRfNodes((nodes) =>
        nodes.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, ...patch } } : node
        )
      );
    },
    [setRfNodes]
  );

  const handleNoteStyleChange = useCallback(
    (
      id: string,
      patch: Partial<Pick<FlowTextNote, "color" | "background" | "fontSize">>
    ) => {
      setTextNotes((prev) =>
        prev.map((note) => (note.id === id ? { ...note, ...patch } : note))
      );
      setRfNodes((nodes) =>
        nodes.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, ...patch } } : node
        )
      );
    },
    [setRfNodes]
  );

  // 선택한 도형/메모를 다른 모든 도형·메모보다 맨 앞 또는 맨 뒤로 보낸다.
  // 음수 zIndex는 요청 카드(기본 0) 뒤로, 양수는 앞으로 가게 된다.
  const handleZOrderChange = useCallback(
    (id: string, toFront: boolean) => {
      const zIndexes = [
        ...shapesRef.current.map((shape) => shape.zIndex ?? 0),
        ...textNotesRef.current.map((note) => note.zIndex ?? 0),
      ];
      const nextZIndex = toFront
        ? getNextFrontZIndex(shapesRef.current, textNotesRef.current)
        : zIndexes.length
        ? Math.min(...zIndexes) - 1
        : -1;

      if (id.startsWith(SHAPE_NODE_PREFIX)) {
        setShapes((prev) =>
          prev.map((shape) =>
            shape.id === id ? { ...shape, zIndex: nextZIndex } : shape
          )
        );
      } else {
        setTextNotes((prev) =>
          prev.map((note) =>
            note.id === id ? { ...note, zIndex: nextZIndex } : note
          )
        );
      }
      setRfNodes((nodes) =>
        nodes.map((node) =>
          node.id === id ? { ...node, zIndex: nextZIndex } : node
        )
      );
    },
    [setRfNodes]
  );

  // 선택한 도형/메모를 복제한다. API 요청 카드는 실제 트래픽과 묶여 있어 제외.
  // 사본은 약간 오른쪽 아래로 옮기고 맨 앞 zIndex를 차례로 부여한다.
  const handleDuplicateNodes = useCallback((ids: string[]) => {
    const shapeList = shapesRef.current;
    const noteList = textNotesRef.current;
    const overrides = positionOverridesRef.current;
    const offset = 28;
    let frontZIndex = getNextFrontZIndex(shapeList, noteList);
    const stamp = Date.now();
    const newShapes: FlowShape[] = [];
    const newNotes: FlowTextNote[] = [];

    ids.forEach((id, index) => {
      const suffix = `${stamp}-${index}`;
      if (id.startsWith(SHAPE_NODE_PREFIX)) {
        const source = shapeList.find((shape) => shape.id === id);
        if (!source) return;
        const base = overrides.get(id) ?? source.position;
        newShapes.push({
          ...source,
          id: `${SHAPE_NODE_PREFIX}${suffix}`,
          position: { x: base.x + offset, y: base.y + offset },
          zIndex: frontZIndex++,
        });
      } else if (id.startsWith(TEXT_NODE_PREFIX)) {
        const source = noteList.find((note) => note.id === id);
        if (!source) return;
        const base = overrides.get(id) ?? source.position;
        newNotes.push({
          ...source,
          id: `${TEXT_NODE_PREFIX}${suffix}`,
          position: { x: base.x + offset, y: base.y + offset },
          zIndex: frontZIndex++,
        });
      }
    });

    if (newShapes.length) setShapes((prev) => [...prev, ...newShapes]);
    if (newNotes.length) setTextNotes((prev) => [...prev, ...newNotes]);
  }, []);

  const handleDuplicateNode = useCallback(
    (id: string) => handleDuplicateNodes([id]),
    [handleDuplicateNodes]
  );

  // 편집이 바뀔 때마다 onLayoutChange로 부모(App)의 flowLayoutRef에 반영한다.
  // 이 ref가 세션 동안(뷰 전환 포함) 레이아웃을 유지하고, export/import 스냅샷의
  // 소스가 된다. localStorage에는 저장하지 않는다(requestId가 세션마다 달라
  // reopen 시 복원이 불가능하므로 stale 데이터만 쌓였다).
  useEffect(() => {
    const layout = {
      positions: Object.fromEntries(positionOverrides),
      deleted: [...deletedIds],
      notes: textNotes,
      deletedEdges: [...deletedEdgeIds],
      manualEdges,
      shapes,
    };
    onLayoutChange(layout);
  }, [
    positionOverrides,
    deletedIds,
    textNotes,
    deletedEdgeIds,
    manualEdges,
    shapes,
    onLayoutChange,
  ]);

  // 세션 import 등 외부에서 레이아웃이 교체되면 저장소에서 다시 읽어 상태에 반영.
  useEffect(() => {
    setPositionOverrides(new Map(Object.entries(layoutSnapshot.positions)));
    setDeletedIds(new Set(layoutSnapshot.deleted));
    setTextNotes(layoutSnapshot.notes);
    setDeletedEdgeIds(new Set(layoutSnapshot.deletedEdges));
    setManualEdges(layoutSnapshot.manualEdges);
    setShapes(layoutSnapshot.shapes);
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
        showQuery,
        collapsePathIds
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
      collapsePathIds,
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
  // 도형도 추가/삭제(구조 변화)만 감지한다. 색/크기 변경은 ref·in-place 갱신으로 처리.
  const shapeIdsKey = useMemo(
    () => shapes.map((shape) => shape.id).join("|"),
    [shapes]
  );

  // 삭제/노드 라벨/메모 추가·삭제 시에만 React Flow 노드 상태를 다시 만든다.
  // positionOverrides·텍스트 내용은 의존성에 넣지 않고 ref로 읽어, 불필요한
  // 전체 재생성(과 그로 인한 포커스 손실/깜빡임)을 피한다.
  useEffect(() => {
    const overrides = positionOverridesRef.current;
    const requestPositions = mergeNodePositions(overrides, autoPositions);
    const nextNodes: Node[] = [
      // 도형은 가장 먼저 추가해 요청 카드/메모 뒤에 깔리도록 한다.
      ...shapesRef.current.map<Node>((shape) => ({
        id: shape.id,
        type: "shape",
        position: overrides.get(shape.id) ?? shape.position,
        width: shape.width,
        height: shape.height,
        draggable: true,
        zIndex: shape.zIndex ?? 0,
        style: { width: shape.width, height: shape.height },
        data: {
          color: shape.color,
          filled: shape.filled,
          onChange: handleShapeChange,
          onZOrder: handleZOrderChange,
          onDuplicate: handleDuplicateNode,
        },
      })),
      ...baseNodes
        .filter((node) => !deletedIds.has(node.id))
        .map((node) => ({
          ...node,
          position: requestPositions.get(node.id) ?? node.position,
          draggable: true,
        })),
      ...textNotesRef.current.map<Node>((note) => {
        const width = note.width ?? TEXT_NOTE_DEFAULT_WIDTH;
        const height = note.height ?? TEXT_NOTE_DEFAULT_HEIGHT;
        return {
          id: note.id,
          type: "textNote",
          position: overrides.get(note.id) ?? note.position,
          draggable: true,
          zIndex: note.zIndex ?? 0,
          width,
          height,
          style: { width, height },
          data: {
            text: note.text,
            color: note.color,
            background: note.background ?? true,
            fontSize: note.fontSize ?? TEXT_NOTE_DEFAULT_FONT_SIZE,
            onTextChange: handleTextChange,
            onStyleChange: handleNoteStyleChange,
            onZOrder: handleZOrderChange,
            onDuplicate: handleDuplicateNode,
          },
        };
      }),
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
    shapeIdsKey,
    handleTextChange,
    handleShapeChange,
    handleNoteStyleChange,
    handleZOrderChange,
    handleDuplicateNode,
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
    manualEdges.length > 0 ||
    shapes.length > 0;

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
      // 도형 리사이즈가 끝났을 때(resizing === false) 크기를 영속 상태에 커밋한다.
      const resized = changes.filter(
        (change): change is Extract<NodeChange, { type: "dimensions" }> =>
          change.type === "dimensions" &&
          Boolean(change.dimensions) &&
          change.resizing === false
      );
      const removedIds = changes
        .filter(
          (change): change is Extract<NodeChange, { type: "remove" }> =>
            change.type === "remove"
        )
        .map((change) => change.id);

      if (resized.length) {
        setShapes((prev) =>
          prev.map((shape) => {
            const change = resized.find((item) => item.id === shape.id);
            return change && change.dimensions
              ? {
                  ...shape,
                  width: change.dimensions.width,
                  height: change.dimensions.height,
                }
              : shape;
          })
        );
        setTextNotes((prev) =>
          prev.map((note) => {
            const change = resized.find((item) => item.id === note.id);
            return change && change.dimensions
              ? {
                  ...note,
                  width: change.dimensions.width,
                  height: change.dimensions.height,
                }
              : note;
          })
        );
      }

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
        setShapes((prev) =>
          prev.filter((shape) => !removedIds.includes(shape.id))
        );
        setDeletedIds((prev) => {
          const next = new Set(prev);
          for (const id of removedIds) {
            // 텍스트/도형은 합성 노드라 삭제 목록(자동 노드 숨김용)에 넣지 않는다.
            if (
              !id.startsWith(TEXT_NODE_PREFIX) &&
              !id.startsWith(SHAPE_NODE_PREFIX)
            ) {
              next.add(id);
            }
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
    // 새로 추가한 메모는 기존 도형/메모보다 맨 앞에 보이게 한다.
    const zIndex = getNextFrontZIndex(shapesRef.current, textNotesRef.current);
    setTextNotes((prev) => [...prev, { id, position, text: "", zIndex }]);
  }, []);

  const handleAddShape = useCallback(() => {
    const instance = flowInstanceRef.current;
    const panel = flowPanelRef.current;
    let center = { x: 0, y: 0 };
    if (instance && panel) {
      const rect = panel.getBoundingClientRect();
      center = instance.screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }
    const id = `${SHAPE_NODE_PREFIX}${Date.now()}`;
    // 새로 추가한 도형은 기존 도형/메모보다 맨 앞에 보이게 한다.
    const zIndex = getNextFrontZIndex(shapesRef.current, textNotesRef.current);
    setShapes((prev) => [
      ...prev,
      {
        id,
        position: {
          x: center.x - SHAPE_DEFAULT_WIDTH / 2,
          y: center.y - SHAPE_DEFAULT_HEIGHT / 2,
        },
        width: SHAPE_DEFAULT_WIDTH,
        height: SHAPE_DEFAULT_HEIGHT,
        color: SHAPE_COLORS[0],
        filled: false,
        zIndex,
      },
    ]);
  }, []);

  const handleResetLayout = useCallback(() => {
    setPositionOverrides(new Map());
    setDeletedIds(new Set());
    setTextNotes([]);
    setDeletedEdgeIds(new Set());
    setManualEdges([]);
    setShapes([]);
  }, []);

  // Cmd/Ctrl+D: 선택된 도형·메모를 복제한다(요청 카드는 제외).
  // 플로우 뷰일 때만 이 컴포넌트가 마운트되므로 window 리스너로 둬도 안전하다.
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "d") {
        return;
      }
      // 입력 필드(메모 textarea 등)에 포커스가 있으면 가로채지 않는다.
      const active = document.activeElement;
      if (
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLInputElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) {
        return;
      }
      const selectedIds = rfNodesRef.current
        .filter(
          (node) =>
            node.selected &&
            (node.id.startsWith(SHAPE_NODE_PREFIX) ||
              node.id.startsWith(TEXT_NODE_PREFIX))
        )
        .map((node) => node.id);
      if (selectedIds.length === 0) return;
      event.preventDefault();
      handleDuplicateNodes(selectedIds);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDuplicateNodes]);

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
      className="flow-panel relative min-h-0 min-w-0 overflow-auto bg-bg max-[820px]:border-b max-[820px]:border-line-weak"
      aria-label="Request flow chart"
      onWheel={handleWheel}
    >
      {items.length === 0 ? (
        <EmptyState title="No API flow captured.">
          Open DevTools, trigger API traffic, then inspect the inferred request
          sequence here.
        </EmptyState>
      ) : !hasMeasuredSize ? null : (
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
            // 선택해도 노드를 위로 끌어올리지 않는다. 그래야 맨 앞/맨 뒤
            // 버튼으로 바꾼 z-index가 선택 중에도 그대로 보인다.
            elevateNodesOnSelect={false}
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
            <Panel position="top-right" className="m-0 mt-3 mr-3">
              <div className="grid max-w-[min(280px,calc(100vw-48px))] justify-items-end gap-1.5">
                <div className="flex flex-wrap justify-end gap-1.5">
                  <Button
                    tone="accent"
                    float
                    active={showQuery}
                    aria-pressed={showQuery}
                    title="카드 타이틀에 쿼리 문자열 표시"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowQuery((value) => !value);
                    }}
                  >
                    {showQuery ? "Query ✓" : "Query"}
                  </Button>
                  <Button
                    tone="accent"
                    float
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleDownloadImage();
                    }}
                    disabled={isExporting}
                  >
                    {isExporting ? "Exporting..." : "Download PNG"}
                  </Button>
                </div>
                {exportError ? (
                  <span className="rounded-[10px] border-0 bg-danger-soft px-2.5 py-[5px] text-right text-[11px] leading-[1.35] text-danger">
                    {exportError}
                  </span>
                ) : null}
              </div>
            </Panel>
            <Panel position="bottom-center" className="mb-4">
              <div className="flex items-center gap-1 rounded-[14px] border border-line-weak bg-surface p-[5px] shadow-float">
                <IconButton
                  size="lg"
                  ghost
                  tone="accent"
                  title="텍스트 메모 추가"
                  aria-label="텍스트 메모 추가"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleAddTextNote();
                  }}
                >
                  <TextIcon />
                </IconButton>
                <IconButton
                  size="lg"
                  ghost
                  tone="accent"
                  title="사각형 도형 추가"
                  aria-label="사각형 도형 추가"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleAddShape();
                  }}
                >
                  <SquareIcon />
                </IconButton>
                {hasEdits ? (
                  <>
                    <span className="mx-0.5 h-5 w-px bg-line-weak" />
                    <IconButton
                      size="lg"
                      ghost
                      tone="danger"
                      title="편집 초기화"
                      aria-label="편집 초기화"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleResetLayout();
                      }}
                    >
                      <ResetIcon />
                    </IconButton>
                  </>
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
