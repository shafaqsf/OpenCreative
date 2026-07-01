"use client";

import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { Copy, Trash2, Layers, ArrowUp, ArrowDown, ClipboardPaste, MousePointer2 } from "lucide-react";
import { useCanvas, newElement, newNode, uid } from "@/lib/canvas/context";
import { screenToWorld, worldToScreen } from "@/lib/canvas/geometry";
import { getElementAtPoint, getBounds } from "@/lib/canvas/hit-test";
import { snapPointToGrid, computeAlignmentSnap, type Guide } from "@/lib/canvas/snap";
import { useToast } from "@/lib/toast/context";
import { ContextMenu, type ContextMenuItem } from "@/components/ui/context-menu";
import { Shape } from "./shape";
import { SelectionOverlay } from "./selection-overlay";
import type { CanvasElement, NodeType, Point, ToolId } from "@/types/canvas";
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
    bringToFront,
    sendToBack,
    clipboard,
    copyToClipboard,
    duplicateSelection,
    selectAll,
    setActiveTool,
    snapToGrid,
    showGrid,
  } = useCanvas();
  const { addToast } = useToast();

  const svgRef = useRef<SVGSVGElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState<DragMode>({ kind: "none" });
  const [marquee, setMarquee] = useState<{ start: Point; end: Point } | null>(
    null
  );
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [connectEnd, setConnectEnd] = useState<Point | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    targetId?: string;
  }>({ open: false, x: 0, y: 0 });
  const [guides, setGuides] = useState<Guide[]>([]);

  const getMousePos = useCallback((e: ReactPointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const getWorldPos = useCallback(
    (e: ReactPointerEvent) => screenToWorld(getMousePos(e), camera),
    [getMousePos, camera]
  );

  const snapWorld = useCallback(
    (point: Point) => (snapToGrid ? snapPointToGrid(point) : point),
    [snapToGrid]
  );

  const computeMoveSnap = useCallback(
    (ids: string[], dx: number, dy: number) => {
      const selected = elements.filter((el) => ids.includes(el.id));
      if (selected.length === 0) return { dx, dy, guides: [] as Guide[] };

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const el of selected) {
        const b = getBounds(el);
        minX = Math.min(minX, b.minX);
        minY = Math.min(minY, b.minY);
        maxX = Math.max(maxX, b.minX + b.w);
        maxY = Math.max(maxY, b.minY + b.h);
      }
      const currentBounds = { minX, minY, w: maxX - minX, h: maxY - minY };
      const nextBounds = {
        minX: currentBounds.minX + dx,
        minY: currentBounds.minY + dy,
        w: currentBounds.w,
        h: currentBounds.h,
      };
      const otherBounds = elements
        .filter((el) => !ids.includes(el.id))
        .map(getBounds);
      const result = computeAlignmentSnap(nextBounds, otherBounds);
      return {
        dx: result.bounds.minX - currentBounds.minX,
        dy: result.bounds.minY - currentBounds.minY,
        guides: result.guides,
      };
    },
    [elements]
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
      const world = snapWorld(getWorldPos(e));

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
        const world = snapWorld(getWorldPos(e));
        updateElement(drag.el.id, {
          width: world.x - drag.start.x,
          height: world.y - drag.start.y,
        });
        return;
      }

      if (drag.kind === "draw") {
        const world = snapWorld(getWorldPos(e));
        setDrag((prev) => {
          if (prev.kind !== "draw") return prev;
          const points = [...(prev.el.points ?? []), world];
          updateElement(prev.el.id, { points });
          return { ...prev, el: { ...prev.el, points } };
        });
        return;
      }

      if (drag.kind === "move") {
        const world = snapWorld(getWorldPos(e));
        const rawDx = world.x - drag.start.x;
        const rawDy = world.y - drag.start.y;
        const { dx, dy, guides } = computeMoveSnap(drag.ids, rawDx, rawDy);
        setGuides(guides);
        moveElements(drag.ids, dx, dy);
        setDrag({ ...drag, start: { x: drag.start.x + dx, y: drag.start.y + dy } });
        return;
      }

      if (drag.kind === "connect") {
        const world = snapWorld(getWorldPos(e));
        setConnectEnd(world);
        return;
      }

      if (marquee) {
        const world = snapWorld(getWorldPos(e));
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
    setGuides([]);
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

  const onDragOver = useCallback((e: React.DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<SVGSVGElement>) => {
      e.preventDefault();
      const toolId = e.dataTransfer.getData("application/opencreative-tool");
      if (!toolId) return;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const screenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const world = screenToWorld(screenPos, camera);

      if (isNodeTool(toolId as NodeType)) {
        const el = newNode(toolId as NodeType, world.x - 90, world.y - 40);
        addElement(el);
        selectElements([el.id]);
      } else if (toolId === "text") {
        const el = newElement("text", world.x, world.y);
        el.height = 20;
        el.width = 80;
        el.text = "";
        addElement(el);
        selectElements([el.id]);
        setEditingTextId(el.id);
      } else if (toolId === "draw") {
        const el = newElement("draw", world.x, world.y);
        el.points = [world];
        addElement(el);
      } else {
        const el = newElement(toolId as Exclude<ToolId, "select">, world.x, world.y);
        addElement(el);
        selectElements([el.id]);
      }
      setActiveTool("select");
    },
    [camera, addElement, selectElements, setActiveTool]
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

  function pasteAt(world: Point) {
    if (clipboard.length === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    for (const el of clipboard) {
      const b = getBounds(el);
      minX = Math.min(minX, b.minX);
      minY = Math.min(minY, b.minY);
    }
    const idMap = new Map<string, string>();
    const clones = clipboard.map((el) => {
      const newId = uid();
      idMap.set(el.id, newId);
      const offsetX = world.x - minX;
      const offsetY = world.y - minY;
      return {
        ...el,
        id: newId,
        x: el.x + offsetX,
        y: el.y + offsetY,
        points: el.points?.map((p) => ({ x: p.x + offsetX, y: p.y + offsetY })),
      };
    });
    clones.forEach(addElement);
    selectElements(clones.map((el) => el.id));
    addToast({ title: "Pasted", message: `${clones.length} item${clones.length === 1 ? "" : "s"} pasted.`, variant: "info", duration: 2000 });
  }

  function copySelected() {
    if (selectedIds.length === 0) return;
    copyToClipboard(selectedIds);
    addToast({ title: "Copied", message: `${selectedIds.length} item${selectedIds.length === 1 ? "" : "s"} copied.`, variant: "info", duration: 2000 });
  }

  function onContextMenu(e: React.MouseEvent<SVGSVGElement>) {
    e.preventDefault();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const screenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const world = screenToWorld(screenPos, camera);
    const hit = getElementAtPoint(elements, world.x, world.y);
    if (hit && !selectedIds.includes(hit.id)) {
      selectElements([hit.id]);
    }
    setContextMenu({ open: true, x: e.clientX, y: e.clientY, targetId: hit?.id });
  }

  function buildMenuItems(): ContextMenuItem[] {
    const hasSelection = selectedIds.length > 0;
    const single = selectedIds.length === 1 ? elements.find((el) => el.id === selectedIds[0]) : undefined;

    const items: ContextMenuItem[] = [];

    if (hasSelection) {
      items.push({
        label: "Copy",
        shortcut: "Ctrl+C",
        icon: <Copy className="size-3.5" />,
        onClick: copySelected,
      });
      items.push({
        label: "Duplicate",
        shortcut: "Ctrl+D",
        icon: <Layers className="size-3.5" />,
        onClick: duplicateSelection,
      });
      items.push({ type: "separator" });
      items.push({
        label: "Bring to front",
        icon: <ArrowUp className="size-3.5" />,
        onClick: () => single ? bringToFront(single.id) : selectedIds.forEach(bringToFront),
      });
      items.push({
        label: "Send to back",
        icon: <ArrowDown className="size-3.5" />,
        onClick: () => single ? sendToBack(single.id) : selectedIds.forEach(sendToBack),
      });
      items.push({ type: "separator" });
      items.push({
        label: "Delete",
        shortcut: "Del",
        danger: true,
        icon: <Trash2 className="size-3.5" />,
        onClick: () => removeElements(selectedIds),
      });
    } else {
      items.push({
        label: "Paste",
        shortcut: "Ctrl+V",
        disabled: clipboard.length === 0,
        icon: <ClipboardPaste className="size-3.5" />,
        onClick: () => {
          const world = screenToWorld({ x: contextMenu.x, y: contextMenu.y }, camera);
          pasteAt(world);
        },
      });
      items.push({ type: "separator" });
      items.push({
        label: "Select all",
        shortcut: "Ctrl+A",
        icon: <MousePointer2 className="size-3.5" />,
        onClick: selectAll,
      });
    }

    return items;
  }

  return (
    <div className="relative h-full w-full">
      <svg
        ref={svgRef}
        className={`h-full w-full touch-none ${showGrid ? "canvas-grid" : ""}`}
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
        onContextMenu={onContextMenu}
        onDragOver={onDragOver}
        onDrop={onDrop}
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
          {guides.map((g, i) =>
            g.type === "horizontal" ? (
              <line
                key={`h-${i}`}
                x1={g.x1}
                y1={g.y}
                x2={g.x2}
                y2={g.y}
                stroke="#2563eb"
                strokeWidth={1 / camera.zoom}
                strokeDasharray={`${4 / camera.zoom} ${3 / camera.zoom}`}
                opacity={0.7}
              />
            ) : (
              <line
                key={`v-${i}`}
                x1={g.x}
                y1={g.y1}
                x2={g.x}
                y2={g.y2}
                stroke="#2563eb"
                strokeWidth={1 / camera.zoom}
                strokeDasharray={`${4 / camera.zoom} ${3 / camera.zoom}`}
                opacity={0.7}
              />
            )
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
      <ContextMenu
        open={contextMenu.open}
        x={contextMenu.x}
        y={contextMenu.y}
        items={buildMenuItems()}
        onClose={() => setContextMenu((prev) => ({ ...prev, open: false }))}
      />
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