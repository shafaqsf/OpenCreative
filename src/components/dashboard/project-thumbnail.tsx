import type { WorkflowState } from "@/types/canvas";
import { getBounds } from "@/lib/canvas/hit-test";

export function ProjectThumbnail({
  workflow,
  className = "",
}: {
  workflow: WorkflowState;
  className?: string;
}) {
  const elements = workflow.elements;
  if (elements.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-neutral-100 ${className}`}
      >
        <span className="text-[10px] text-neutral-400">Empty canvas</span>
      </div>
    );
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    const b = getBounds(el);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.minX + b.w);
    maxY = Math.max(maxY, b.minY + b.h);
  }
  const padding = 40;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;
  const w = maxX - minX;
  const h = maxY - minY;

  return (
    <svg
      viewBox={`${minX} ${minY} ${w} ${h}`}
      className={`bg-neutral-100 ${className}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x={minX} y={minY} width={w} height={h} fill="#f5f5f5" />
      {elements.map((el) => {
        const b = getBounds(el);
        const color =
          el.type === "generate"
            ? "#171717"
            : el.type === "prompt"
              ? "#525252"
              : el.type === "source"
                ? "#737373"
                : "#a3a3a3";
        return (
          <rect
            key={el.id}
            x={b.minX}
            y={b.minY}
            width={b.w}
            height={b.h}
            rx={6}
            fill="white"
            stroke={color}
            strokeWidth={2}
          />
        );
      })}
      {workflow.connections.map((c) => {
        const from = elements.find((e) => e.id === c.fromId);
        const to = elements.find((e) => e.id === c.toId);
        if (!from || !to) return null;
        const fb = getBounds(from);
        const tb = getBounds(to);
        const x1 = fb.minX + fb.w;
        const y1 = fb.minY + fb.h / 2;
        const x2 = tb.minX;
        const y2 = tb.minY + tb.h / 2;
        return (
          <line
            key={c.id}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#171717"
            strokeWidth={1.5}
          />
        );
      })}
    </svg>
  );
}
