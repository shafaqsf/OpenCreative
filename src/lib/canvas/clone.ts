import type { CanvasElement } from "@/types/canvas";
import { uid } from "./context";

export function cloneElements(
  elements: CanvasElement[],
  offsetX = 0,
  offsetY = 0,
  idMap?: Map<string, string>
): CanvasElement[] {
  const map = idMap ?? new Map<string, string>();
  return elements.map((el) => {
    const newId = uid();
    map.set(el.id, newId);
    return {
      ...el,
      id: newId,
      x: el.x + offsetX,
      y: el.y + offsetY,
      points: el.points?.map((p) => ({ x: p.x + offsetX, y: p.y + offsetY })),
    };
  });
}
