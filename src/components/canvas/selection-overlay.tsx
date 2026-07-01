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
  const handleSize = 8 / zoom;

  return (
    <g>
      {selected.map((el) => {
        const { minX, minY, w, h } = getBounds(el);
        const handles =
          selected.length === 1
            ? [
                [minX, minY],
                [minX + w / 2, minY],
                [minX + w, minY],
                [minX + w, minY + h / 2],
                [minX + w, minY + h],
                [minX + w / 2, minY + h],
                [minX, minY + h],
                [minX, minY + h / 2],
              ]
            : [];
        return (
          <g key={el.id}>
            <rect
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
            {handles.map(([x, y], i) => (
              <rect
                key={i}
                x={x - handleSize / 2}
                y={y - handleSize / 2}
                width={handleSize}
                height={handleSize}
                fill="#ffffff"
                stroke="#171717"
                strokeWidth={sw}
                rx={1.5 / zoom}
              />
            ))}
          </g>
        );
      })}
    </g>
  );
}
