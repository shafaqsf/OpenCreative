"use client";

import type { CanvasElement } from "@/types/canvas";
import { getBounds } from "@/lib/canvas/hit-test";

export function Shape({ element }: { element: CanvasElement }) {
  const { minX, minY, w, h } = getBounds(element);
  const props = {
    stroke: element.stroke,
    fill: element.fill,
    strokeWidth: element.strokeWidth,
  };

  let shape: React.ReactNode = null;

  switch (element.type) {
    case "rectangle":
      shape = <rect x={minX} y={minY} width={w} height={h} rx={2} {...props} />;
      break;
    case "ellipse":
      shape = (
        <ellipse
          cx={minX + w / 2}
          cy={minY + h / 2}
          rx={w / 2}
          ry={h / 2}
          {...props}
        />
      );
      break;
    case "line":
      shape = (
        <line
          x1={element.x}
          y1={element.y}
          x2={element.x + element.width}
          y2={element.y + element.height}
          {...props}
          strokeLinecap="round"
        />
      );
      break;
    case "arrow":
      shape = <Arrow element={element} />;
      break;
    case "draw":
      shape = (
        <polyline
          points={element.points?.map((p) => `${p.x},${p.y}`).join(" ") ?? ""}
          fill="none"
          stroke={element.stroke}
          strokeWidth={element.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
      break;
    case "text":
      shape = (
        <text
          x={element.x}
          y={element.y + (Math.abs(element.height) || 16)}
          fill={element.stroke}
          fontSize={16}
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          dominantBaseline="hanging"
        >
          {element.text || "Text"}
        </text>
      );
      break;
  }

  return <g>{shape}</g>;
}

function Arrow({ element }: { element: CanvasElement }) {
  const x1 = element.x;
  const y1 = element.y;
  const x2 = element.x + element.width;
  const y2 = element.y + element.height;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = 12;
  const headAngle = Math.PI / 6;
  const hx1 = x2 - headLen * Math.cos(angle - headAngle);
  const hy1 = y2 - headLen * Math.sin(angle - headAngle);
  const hx2 = x2 - headLen * Math.cos(angle + headAngle);
  const hy2 = y2 - headLen * Math.sin(angle + headAngle);

  return (
    <g
      stroke={element.stroke}
      fill={element.stroke}
      strokeWidth={element.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <polygon points={`${x2},${y2} ${hx1},${hy1} ${hx2},${hy2}`} />
    </g>
  );
}