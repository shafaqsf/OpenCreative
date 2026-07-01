"use client";

import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { useCanvas, newElement } from "@/lib/canvas/context";
import { screenToWorld } from "@/lib/canvas/geometry";
import { getElementAtPoint } from "@/lib/canvas/hit-test";
import { Shape } from "./shape";
import { SelectionOverlay } from "./selection-overlay";
import type { CanvasElement, Point } from "@/types/canvas";

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
      kind: "text";
      el: CanvasElement;
    };

export function Canvas() {
  const {
    elements,
    selectedIds,
    activeTool,
    camera,
    addElement,
    updateElement,
    removeElements,
    selectElements,
    toggleSelection,
    clearSelection,
    moveElements,
    setCamera,
  } = useCanvas();

  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragMode>({ kind: "none" });
  const [marquee, setMarquee] = useState<{ start: Point; end: Point } | null>(
    null
  );

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
          if (e.shiftKey) {
            toggleSelection(hit.id);
          } else if (!selectedIds.includes(hit.id)) {
            selectElements([hit.id]);
          }
          setDrag({ kind: "move", start: world, ids: selectedIds.length > 0 && selectedIds.includes(hit.id) ? selectedIds : [hit.id] });
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
        setDrag({ kind: "text", el });
        return;
      }

      if (activeTool === "draw") {
        const el = newElement("draw", world.x, world.y);
        el.points = [world];
        addElement(el);
        setDrag({ kind: "draw", el });
        return;
      }

      const el = newElement(activeTool, world.x, world.y);
      addElement(el);
      setDrag({ kind: "create", start: world, el });
    },
    [
      activeTool,
      elements,
      selectedIds,
      camera,
      getMousePos,
      getWorldPos,
      addElement,
      toggleSelection,
      selectElements,
      clearSelection,
    ]
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (drag.kind === "none" && !marquee) return;

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

      if (marquee) {
        const world = getWorldPos(e);
        setMarquee({ start: marquee.start, end: world });
        return;
      }
    },
    [drag, marquee, getMousePos, getWorldPos, setCamera, updateElement, moveElements]
  );

  const onPointerUp = useCallback(() => {
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
    if (drag.kind === "text") {
      const el = drag.el;
      const userInput = window.prompt("Enter text:", el.text || "");
      if (userInput === null || userInput.trim() === "") {
        removeElements([el.id]);
      } else {
        updateElement(el.id, { text: userInput });
        selectElements([el.id]);
      }
    }
    if (marquee) {
      const minX = Math.min(marquee.start.x, marquee.end.x);
      const minY = Math.min(marquee.start.y, marquee.end.y);
      const maxX = Math.max(marquee.start.x, marquee.end.x);
      const maxY = Math.max(marquee.start.y, marquee.end.y);
      const hits = elements.filter((el) => {
        const b = getElBounds(el);
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
  }, [drag, marquee, removeElements, selectElements, updateElement, elements]);

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
      : activeTool === "select"
        ? "default"
        : "crosshair";

  return (
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
  );
}

function zoomAt(cam: { x: number; y: number; zoom: number }, mx: number, my: number, factor: number) {
  const newZoom = Math.min(Math.max(cam.zoom * factor, 0.1), 10);
  const ratio = newZoom / cam.zoom;
  return {
    zoom: newZoom,
    x: mx - (mx - cam.x) * ratio,
    y: my - (my - cam.y) * ratio,
  };
}

function getElBounds(el: CanvasElement) {
  if (el.points && el.points.length > 0) {
    const xs = el.points.map((p) => p.x);
    const ys = el.points.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return { minX, minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
  }
  const w = Math.abs(el.width);
  const h = Math.abs(el.height);
  return {
    minX: el.width >= 0 ? el.x : el.x + el.width,
    minY: el.height >= 0 ? el.y : el.y + el.height,
    w,
    h,
  };
}