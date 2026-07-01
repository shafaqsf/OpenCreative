"use client";

import type { CanvasElement } from "@/types/canvas";
import { getBounds } from "@/lib/canvas/hit-test";

export function SelectionOverlay({
  elements,
  selectedIds,
  zoom,
}: {
  elements: CanvasElement[];
  selectedIds: string[];
  zoom: number;
}) {
  const selected = elements.filter((el) => selectedIds.includes(el.id));
  if (selected.length === 0) return null;
  const sw = 1.5 / zoom;

  return (
    <g>
      {selected.map((el) => {
        const { minX, minY, w, h } = getBounds(el);
        return (
          <rect
            key={el.id}
            x={minX - 4 / zoom}
            y={minY - 4 / zoom}
            width={w + 8 / zoom}
            height={h + 8 / zoom}
            fill="none"
            stroke="#171717"
            strokeWidth={sw}
            strokeDasharray={`${4 / zoom} ${3 / zoom}`}
            rx={2 / zoom}
          />
        );
      })}
    </g>
  );
}