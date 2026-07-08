/**
 * Flow 차트의 커스텀 노드 뷰 3종(API 요청 카드 / 텍스트 메모 / 사각형 도형)과
 * React Flow에 등록하는 NODE_TYPES 매핑.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Handle,
  NodeResizer,
  Position,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import type { FlowShape, FlowTextNote } from "../../utils/flowLayoutPrefs";
import { IconButton } from "../ui/Button";
import { BringToFrontIcon, CopyIcon, SendToBackIcon } from "./FlowChartIcons";
import {
  SHAPE_COLORS,
  SHAPE_MIN_SIZE,
  TEXT_NOTE_FONT_STEP,
  TEXT_NOTE_MAX_FONT_SIZE,
  TEXT_NOTE_MIN_FONT_SIZE,
  TEXT_NOTE_MIN_HEIGHT,
  TEXT_NOTE_MIN_WIDTH,
} from "./flowChartConstants";

export type TextNoteData = {
  text: string;
  color?: string;
  background: boolean;
  fontSize: number;
  onTextChange: (id: string, text: string) => void;
  onStyleChange: (
    id: string,
    patch: Partial<Pick<FlowTextNote, "color" | "background" | "fontSize">>
  ) => void;
  onZOrder: (id: string, toFront: boolean) => void;
  onDuplicate: (id: string) => void;
};

export type ShapeData = {
  color: string;
  filled: boolean;
  onChange: (id: string, patch: Partial<Pick<FlowShape, "color" | "filled">>) => void;
  onZOrder: (id: string, toFront: boolean) => void;
  onDuplicate: (id: string) => void;
};

export type RequestNodeData = {
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

// 도형/메모 툴바에 공통으로 들어가는 레이어 순서 버튼 한 쌍.
function ZOrderButtons({
  id,
  onZOrder,
}: {
  id: string;
  onZOrder: (id: string, toFront: boolean) => void;
}) {
  return (
    <>
      <IconButton
        size="xs"
        tone="accent"
        title="맨 앞으로"
        aria-label="맨 앞으로"
        onClick={() => onZOrder(id, true)}
      >
        <BringToFrontIcon />
      </IconButton>
      <IconButton
        size="xs"
        tone="accent"
        title="맨 뒤로"
        aria-label="맨 뒤로"
        onClick={() => onZOrder(id, false)}
      >
        <SendToBackIcon />
      </IconButton>
    </>
  );
}

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
function TextNoteNodeView({ id, data, selected }: NodeProps) {
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

  const fontSize = noteData.fontSize;
  return (
    <div className={`flow-text-note ${noteData.background ? "" : "no-bg"}`}>
      <NodeResizer
        isVisible={selected}
        minWidth={TEXT_NOTE_MIN_WIDTH}
        minHeight={TEXT_NOTE_MIN_HEIGHT}
        lineClassName="flow-shape-resize-line"
        handleClassName="flow-shape-resize-handle"
      />
      <textarea
        className="nodrag flow-text-note-input"
        value={value}
        placeholder="메모 입력..."
        autoFocus={isInitialEmpty.current}
        style={{ fontSize, ...(noteData.color ? { color: noteData.color } : {}) }}
        onChange={(event) => {
          setValue(event.target.value);
          noteData.onTextChange(id, event.target.value);
        }}
        onPointerDown={(event) => event.stopPropagation()}
        // 입력 중 키 입력이 React Flow(삭제 단축키 등)로 전파되지 않도록 막는다.
        onKeyDown={(event) => event.stopPropagation()}
      />
      {selected ? (
        <div
          className="nodrag flow-shape-toolbar"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {SHAPE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`flow-shape-swatch ${
                noteData.color === color ? "active" : ""
              }`}
              style={{ background: color }}
              title="글자 색 변경"
              aria-label={`글자 색 ${color}`}
              onClick={() => noteData.onStyleChange(id, { color })}
            />
          ))}
          <span className="flow-shape-toolbar-divider" />
          <IconButton
            size="xs"
            tone="accent"
            className="flow-shape-font-button"
            title="글자 작게"
            aria-label="글자 작게"
            disabled={fontSize <= TEXT_NOTE_MIN_FONT_SIZE}
            onClick={() =>
              noteData.onStyleChange(id, {
                fontSize: Math.max(
                  TEXT_NOTE_MIN_FONT_SIZE,
                  fontSize - TEXT_NOTE_FONT_STEP
                ),
              })
            }
          >
            A−
          </IconButton>
          <IconButton
            size="xs"
            tone="accent"
            className="flow-shape-font-button"
            title="글자 크게"
            aria-label="글자 크게"
            disabled={fontSize >= TEXT_NOTE_MAX_FONT_SIZE}
            onClick={() =>
              noteData.onStyleChange(id, {
                fontSize: Math.min(
                  TEXT_NOTE_MAX_FONT_SIZE,
                  fontSize + TEXT_NOTE_FONT_STEP
                ),
              })
            }
          >
            A+
          </IconButton>
          <span className="flow-shape-toolbar-divider" />
          <IconButton
            size="xs"
            active={noteData.background}
            className="flow-shape-fill-toggle"
            title={noteData.background ? "배경 없애기" : "배경 표시"}
            onClick={() =>
              noteData.onStyleChange(id, { background: !noteData.background })
            }
          >
            BG
          </IconButton>
          <span className="flow-shape-toolbar-divider" />
          <ZOrderButtons id={id} onZOrder={noteData.onZOrder} />
          <IconButton
            size="xs"
            tone="accent"
            title="복사"
            aria-label="복사"
            onClick={() => noteData.onDuplicate(id)}
          >
            <CopyIcon />
          </IconButton>
        </div>
      ) : null}
    </div>
  );
}

// 사각형 도형 노드. 색 채움/테두리만 토글과 색상 선택을 지원한다.
function ShapeNodeView({ id, data, selected }: NodeProps) {
  const shapeData = data as ShapeData;
  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={SHAPE_MIN_SIZE}
        minHeight={SHAPE_MIN_SIZE}
        lineClassName="flow-shape-resize-line"
        handleClassName="flow-shape-resize-handle"
      />
      <div
        className="flow-shape"
        style={{
          borderColor: shapeData.color,
          background: shapeData.filled
            ? hexWithAlpha(shapeData.color, 0.18)
            : "transparent",
        }}
      />
      {selected ? (
        <div
          className="nodrag flow-shape-toolbar"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {SHAPE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`flow-shape-swatch ${
                shapeData.color === color ? "active" : ""
              }`}
              style={{ background: color }}
              title="색상 변경"
              aria-label={`색상 ${color}`}
              onClick={() => shapeData.onChange(id, { color })}
            />
          ))}
          <span className="flow-shape-toolbar-divider" />
          <IconButton
            size="xs"
            active={shapeData.filled}
            className="flow-shape-fill-toggle"
            title={shapeData.filled ? "테두리만 표시" : "색 채우기"}
            onClick={() => shapeData.onChange(id, { filled: !shapeData.filled })}
          >
            {shapeData.filled ? "Fill" : "Line"}
          </IconButton>
          <span className="flow-shape-toolbar-divider" />
          <ZOrderButtons id={id} onZOrder={shapeData.onZOrder} />
          <IconButton
            size="xs"
            tone="accent"
            title="복사"
            aria-label="복사"
            onClick={() => shapeData.onDuplicate(id)}
          >
            <CopyIcon />
          </IconButton>
        </div>
      ) : null}
    </>
  );
}

export const NODE_TYPES: NodeTypes = {
  requestNode: RequestNodeView,
  textNote: TextNoteNodeView,
  shape: ShapeNodeView,
};

// #rrggbb 색에 알파를 더해 반투명 채움 색을 만든다.
function hexWithAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return hex;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
