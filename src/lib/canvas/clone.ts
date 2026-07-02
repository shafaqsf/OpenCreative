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
      nodeData: el.nodeData
        ? {
            ...el.nodeData,
            properties: { ...el.nodeData.properties },
            outputUrls: el.nodeData.outputUrls ? [...el.nodeData.outputUrls] : undefined,
            outputVersions: el.nodeData.outputVersions
              ? el.nodeData.outputVersions.map((version) => ({
                  ...version,
                  editMetadata: version.editMetadata ? { ...version.editMetadata } : undefined,
                }))
              : undefined,
          }
        : undefined,
    };
  });
}
