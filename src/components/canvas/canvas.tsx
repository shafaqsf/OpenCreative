"use client";

import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { useCanvas, newElement, newNode } from "@/lib/canvas/context";
import { screenToWorld, worldToScreen } from "@/lib/canvas/geometry";
import { getElementAtPoint, getBounds } from "@/lib/canvas/hit-test";
import { Shape } from "./shape";
import { SelectionOverlay } from "./selection-overlay";
import type { CanvasElement, NodeType, Point } from "@/types/canvas";
import { isNodeTool } from "@/types/canvas";

type DragMode =
  | { kind: "none" }
  | { kind: "pan"; start: Point; camStart: Point }
  | {
      kind: "create";
      start: Point;
      el: CanvasElement;
    }
  | {
      kind: "draw";
      el: CanvasElement;
    }
  | {
      kind: "move";
      start: Point;
      ids: string[];
    }
  | {
      kind: "connect";
      fromId: string;
      start: Point;
    };

export function Canvas() {
  const {
    elements,
    selectedIds,
    activeTool,
    camera,
    connections,
    addElement,
    updateElement,
    removeElements,
    selectElements,
    toggleSelection,
    clearSelection,
    moveElements,
    setCamera,
    addConnection,
  } = useCanvas();

  const svgRef = useRef<SVGSVGElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState<DragMode>({ kind: "none" });
  const [marquee, setMarquee] = useState<{ start: Point; end: Point } | null>(
    null
  );
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [connectEnd, setConnectEnd] = useState<Point | null>(null);

  const getMousePos = useCallback((e: ReactPointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const getWorldPos = useCallback(
    (e: ReactPointerEvent) => screenToWorld(getMousePos(e), camera),
    [getMousePos, camera]
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        const pos = getMousePos(e);
        setDrag({
          kind: "pan",
          start: pos,
          camStart: { x: camera.x, y: camera.y },
        });
        return;
      }

      if (e.button !== 0) return;
      const world = getWorldPos(e);

      if (activeTool === "select") {
        const hit = getElementAtPoint(elements, world.x, world.y);
        if (hit) {
          if (isNodeTool(hit.type)) {
            const b = getBounds(hit);
            const nearInput = Math.abs(world.x - b.minX) < 10;
            const nearOutput = Math.abs(world.x - b.minX - b.w) < 10;
            if (nearOutput) {
              clearSelection();
              selectElements([hit.id]);
              setDrag({ kind: "connect", fromId: hit.id, start: world });
              setConnectEnd(world);
              return;
            }
          }
          if (e.shiftKey) {
            toggleSelection(hit.id);
          } else if (!selectedIds.includes(hit.id)) {
            selectElements([hit.id]);
          }
          setDrag({
            kind: "move",
            start: world,
            ids:
              selectedIds.length > 0 && selectedIds.includes(hit.id)
                ? selectedIds
                : [hit.id],
          });
        } else {
          if (!e.shiftKey) clearSelection();
          setMarquee({ start: world, end: world });
        }
        return;
      }

      if (activeTool === "text") {
        const el = newElement("text", world.x, world.y);
        el.height = 20;
        el.width = 80;
        el.text = "";
        addElement(el);
        selectElements([el.id]);
        setEditingTextId(el.id);
        return;
      }

      if (activeTool === "draw") {
        const el = newElement("draw", world.x, world.y);
        el.points = [world];
        addElement(el);
        setDrag({ kind: "draw", el });
        return;
      }

      if (isNodeTool(activeTool)) {
        const el = newNode(activeTool as NodeType, world.x - 90, world.y - 40);
        addElement(el);
        selectElements([el.id]);
        return;
      }

      const el = newElement(activeTool, world.x, world.y);
      addElement(el);
      setDrag({ kind: "create", start: world, el });
    },
    [activeTool, elements, selectedIds, camera, getMousePos, getWorldPos, addElement, toggleSelection, selectElements, clearSelection, addConnection]
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (drag.kind === "none" && !marquee && !connectEnd) return;

      if (drag.kind === "pan") {
        const pos = getMousePos(e);
        setCamera((prev) => ({
          ...prev,
          x: drag.camStart.x + (pos.x - drag.start.x),
          y: drag.camStart.y + (pos.y - drag.start.y),
        }));
        return;
      }

      if (drag.kind === "create") {
        const world = getWorldPos(e);
        updateElement(drag.el.id, {
          width: world.x - drag.start.x,
          height: world.y - drag.start.y,
        });
        return;
      }

      if (drag.kind === "draw") {
        const world = getWorldPos(e);
        setDrag((prev) => {
          if (prev.kind !== "draw") return prev;
          const points = [...(prev.el.points ?? []), world];
          updateElement(prev.el.id, { points });
          return { ...prev, el: { ...prev.el, points } };
        });
        return;
      }

      if (drag.kind === "move") {
        const world = getWorldPos(e);
        const dx = world.x - drag.start.x;
        const dy = world.y - drag.start.y;
        moveElements(drag.ids, dx, dy);
        setDrag({ ...drag, start: world });
        return;
      }

      if (drag.kind === "connect") {
        const world = getWorldPos(e);
        setConnectEnd(world);
        return;
      }

      if (marquee) {
        const world = getWorldPos(e);
        setMarquee({ start: marquee.start, end: world });
        return;
      }
    },
    [drag, marquee, connectEnd, getMousePos, getWorldPos, setCamera, updateElement, moveElements]
  );

  const onPointerUp = useCallback(() => {
    if (drag.kind === "connect") {
      const target = getElementAtPoint(elements, connectEnd?.x ?? 0, connectEnd?.y ?? 0);
      if (target && target.id !== drag.fromId && isNodeTool(target.type)) {
        const b = getBounds(target);
        const nearInput = Math.abs((connectEnd?.x ?? 0) - b.minX) < 15;
        if (nearInput) {
          addConnection(drag.fromId, target.id);
        }
      }
    }

    if (drag.kind === "create") {
      const current = elements.find((el) => el.id === drag.el.id);
      const w = Math.abs(current?.width ?? drag.el.width);
      const h = Math.abs(current?.height ?? drag.el.height);
      if (w < 3 && h < 3) {
        removeElements([drag.el.id]);
      } else {
        selectElements([drag.el.id]);
      }
    }

    if (marquee) {
      const minX = Math.min(marquee.start.x, marquee.end.x);
      const minY = Math.min(marquee.start.y, marquee.end.y);
      const maxX = Math.max(marquee.start.x, marquee.end.x);
      const maxY = Math.max(marquee.start.y, marquee.end.y);
      const hits = elements.filter((el) => {
        const b = getBounds(el);
        return (
          b.minX >= minX &&
          b.minY >= minY &&
          b.minX + b.w <= maxX &&
          b.minY + b.h <= maxY
        );
      });
      if (hits.length > 0) selectElements(hits.map((h) => h.id));
    }

    setDrag({ kind: "none" });
    setMarquee(null);
    setConnectEnd(null);
  }, [drag, marquee, connectEnd, elements, removeElements, selectElements, addConnection]);

  const onWheel = useCallback(
    (e: ReactWheelEvent<SVGSVGElement>) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = svgRef.current?.getBoundingClientRect();
        const mx = rect ? e.clientX - rect.left : 0;
        const my = rect ? e.clientY - rect.top : 0;
        const delta = -e.deltaY * 0.0015;
        setCamera((prev) => zoomAt(prev, mx, my, Math.exp(delta)));
      } else {
        setCamera((prev) => ({
          ...prev,
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    },
    [setCamera]
  );

  const cursor =
    drag.kind === "pan"
      ? "grabbing"
      : drag.kind === "connect"
        ? "crosshair"
        : activeTool === "select"
          ? "default"
          : "crosshair";

  const editingEl = editingTextId
    ? elements.find((el) => el.id === editingTextId)
    : null;
  const editingScreen = editingEl
    ? worldToScreen({ x: editingEl.x, y: editingEl.y }, camera)
    : null;

  function commitText(value: string) {
    if (!editingTextId) return;
    if (value.trim() === "") {
      removeElements([editingTextId]);
    } else {
      updateElement(editingTextId, { text: value });
      selectElements([editingTextId]);
    }
    setEditingTextId(null);
  }

  return (
    <div className="relative h-full w-full">
      <svg
        ref={svgRef}
        className="canvas-grid h-full w-full touch-none"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
      >
        <g
          style={{
            transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {connections.map((conn) => {
            const from = elements.find((el) => el.id === conn.fromId);
            const to = elements.find((el) => el.id === conn.toId);
            if (!from || !to) return null;
            const fb = getBounds(from);
            const tb = getBounds(to);
            const x1 = fb.minX + fb.w;
            const y1 = fb.minY + fb.h / 2;
            const x2 = tb.minX;
            const y2 = tb.minY + tb.h / 2;
            const cx1 = x1 + Math.abs(x2 - x1) * 0.4;
            const cx2 = x2 - Math.abs(x2 - x1) * 0.4;
            return (
              <path
                key={conn.id}
                d={`M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke="#171717"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            );
          })}

          {drag.kind === "connect" && connectEnd && (
            <line
              x1={drag.start.x}
              y1={drag.start.y}
              x2={connectEnd.x}
              y2={connectEnd.y}
              stroke="#171717"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          )}

          {elements.map((el) => (
            <Shape key={el.id} element={el} />
          ))}
          <SelectionOverlay
            elements={elements}
            selectedIds={selectedIds}
            zoom={camera.zoom}
          />
          {marquee && (
            <rect
              x={Math.min(marquee.start.x, marquee.end.x)}
              y={Math.min(marquee.start.y, marquee.end.y)}
              width={Math.abs(marquee.end.x - marquee.start.x)}
              height={Math.abs(marquee.end.y - marquee.start.y)}
              fill="rgba(23,23,23,0.06)"
              stroke="#171717"
              strokeWidth={1 / camera.zoom}
              strokeDasharray={`${4 / camera.zoom} ${3 / camera.zoom}`}
            />
          )}
        </g>
      </svg>
      {editingScreen && editingEl && (
        <input
          ref={inputRef}
          autoFocus
          defaultValue={editingEl.text || ""}
          onBlur={(e) => commitText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitText(e.currentTarget.value);
            if (e.key === "Escape") {
              if (!editingEl.text) removeElements([editingEl.id]);
              setEditingTextId(null);
            }
          }}
          className="absolute z-10 border border-neutral-900 bg-white px-1.5 py-0.5 text-sm text-neutral-900 outline-none"
          style={{
            left: editingScreen.x,
            top: editingScreen.y,
            minWidth: 80,
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          }}
        />
      )}
    </div>
  );
}

function zoomAt(
  cam: { x: number; y: number; zoom: number },
  mx: number,
  my: number,
  factor: number
) {
  const newZoom = Math.min(Math.max(cam.zoom * factor, 0.1), 10);
  const ratio = newZoom / cam.zoom;
  return {
    zoom: newZoom,
    x: mx - (mx - cam.x) * ratio,
    y: my - (my - cam.y) * ratio,
  };
}