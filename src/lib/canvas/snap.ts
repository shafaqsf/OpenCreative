import type { Point, CanvasElement } from "@/types/canvas";
import { getBounds } from "@/lib/canvas/hit-test";

export const GRID_SIZE = 22;

type Bounds = { minX: number; minY: number; w: number; h: number };

export function snapToGrid(value: number, grid = GRID_SIZE): number {
  return Math.round(value / grid) * grid;
}

export function snapPointToGrid(point: Point, grid = GRID_SIZE): Point {
  return { x: snapToGrid(point.x, grid), y: snapToGrid(point.y, grid) };
}

export type Guide =
  | { type: "horizontal"; y: number; x1: number; x2: number }
  | { type: "vertical"; x: number; y1: number; y2: number };

const THRESHOLD = 6;

type Edge = "minX" | "midX" | "maxX" | "minY" | "midY" | "maxY";

function edgeValue(b: Bounds, edge: Edge): number {
  switch (edge) {
    case "minX":
      return b.minX;
    case "midX":
      return b.minX + b.w / 2;
    case "maxX":
      return b.minX + b.w;
    case "minY":
      return b.minY;
    case "midY":
      return b.minY + b.h / 2;
    case "maxY":
      return b.minY + b.h;
  }
}

function setEdgeValue(b: Bounds, edge: Edge, value: number): Bounds {
  switch (edge) {
    case "minX":
      return { ...b, minX: value, w: b.w + b.minX - value };
    case "midX":
      return { ...b, minX: value - b.w / 2 };
    case "maxX":
      return { ...b, minX: value - b.w, w: b.w };
    case "minY":
      return { ...b, minY: value, h: b.h + b.minY - value };
    case "midY":
      return { ...b, minY: value - b.h / 2 };
    case "maxY":
      return { ...b, minY: value - b.h, h: b.h };
  }
}

export function computeAlignmentSnap(
  draggingBounds: Bounds,
  others: Bounds[],
  boundsProvider: (b: Bounds) => Bounds = (b) => b
): { bounds: Bounds; guides: Guide[] } {
  let result = boundsProvider(draggingBounds);
  const guides: Guide[] = [];

  const xEdges: Edge[] = ["minX", "midX", "maxX"];
  const yEdges: Edge[] = ["minY", "midY", "maxY"];

  let snappedX = false;
  let snappedY = false;

  for (const other of others) {
    if (snappedX && snappedY) break;
    for (const edge of xEdges) {
      if (snappedX) break;
      const val = edgeValue(result, edge);
      for (const otherEdge of xEdges) {
        const otherVal = edgeValue(other, otherEdge);
        if (Math.abs(val - otherVal) < THRESHOLD) {
          result = setEdgeValue(result, edge, otherVal);
          guides.push({
            type: "vertical",
            x: otherVal,
            y1: Math.min(result.minY, other.minY) - 40,
            y2: Math.max(result.minY + result.h, other.minY + other.h) + 40,
          });
          snappedX = true;
          break;
        }
      }
    }
    for (const edge of yEdges) {
      if (snappedY) break;
      const val = edgeValue(result, edge);
      for (const otherEdge of yEdges) {
        const otherVal = edgeValue(other, otherEdge);
        if (Math.abs(val - otherVal) < THRESHOLD) {
          result = setEdgeValue(result, edge, otherVal);
          guides.push({
            type: "horizontal",
            y: otherVal,
            x1: Math.min(result.minX, other.minX) - 40,
            x2: Math.max(result.minX + result.w, other.minX + other.w) + 40,
          });
          snappedY = true;
          break;
        }
      }
    }
  }

  return { bounds: result, guides };
}

export function getBoundsForElements(elements: CanvasElement[]): Bounds[] {
  return elements.map(getBounds);
}
