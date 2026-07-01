"use client";

import type { CanvasElement, NodeType } from "@/types/canvas";
import { getBounds } from "@/lib/canvas/hit-test";

const NODE_LABELS: Record<NodeType, string> = {
  node_prompt: "Prompt",
  node_image: "Image",
  node_video: "Video",
  node_upload: "Upload",
  node_output: "Output",
};

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
    case "triangle":
      shape = (
        <polygon
          points={`${minX + w / 2},${minY} ${minX + w},${minY + h} ${minX},${minY + h}`}
          {...props}
          strokeLinejoin="round"
        />
      );
      break;
    case "diamond":
      shape = (
        <polygon
          points={`${minX + w / 2},${minY} ${minX + w},${minY + h / 2} ${minX + w / 2},${minY + h} ${minX},${minY + h / 2}`}
          {...props}
          strokeLinejoin="round"
        />
      );
      break;
    case "star":
      shape = (
        <polygon
          points={starPoints(minX + w / 2, minY + h / 2, w / 2, h / 2)}
          {...props}
          strokeLinejoin="round"
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
    default:
      if (element.type.startsWith("node_")) {
        shape = <WorkflowNode element={element} />;
      }
      break;
  }

  return <g>{shape}</g>;
}

function WorkflowNode({ element }: { element: CanvasElement }) {
  const { minX, minY, w, h } = getBounds(element);
  const type = element.type as NodeType;
  const label = element.nodeData?.label || NODE_LABELS[type] || "Node";
  const fill = type === "node_output" ? "#171717" : "#ffffff";
  const textFill = type === "node_output" ? "#ffffff" : "#171717";
  return (
    <g>
      <rect
        x={minX}
        y={minY}
        width={w}
        height={h}
        rx={6}
        fill={fill}
        stroke={element.stroke}
        strokeWidth={element.strokeWidth}
      />
      <circle
        cx={minX}
        cy={minY + h / 2}
        r={4}
        fill="#171717"
        stroke="none"
      />
      <circle
        cx={minX + w}
        cy={minY + h / 2}
        r={4}
        fill="#171717"
        stroke="none"
      />
      <text
        x={minX + w / 2}
        y={minY + h / 2}
        fill={textFill}
        fontSize={12}
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {label}
      </text>
    </g>
  );
}

function starPoints(cx: number, cy: number, rx: number, ry: number) {
  const outer: [number, number][] = [];
  const inner: [number, number][] = [];
  const spikes = 5;
  for (let i = 0; i < spikes; i++) {
    const a = (Math.PI * 2 * i) / spikes - Math.PI / 2;
    const a2 = (Math.PI * 2 * (i + 0.5)) / spikes - Math.PI / 2;
    outer.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
    inner.push([cx + (rx * 0.4) * Math.cos(a2), cy + (ry * 0.4) * Math.sin(a2)]);
  }
  return outer
    .flatMap((p, i) => [p, inner[i]])
    .map((p) => p.join(","))
    .join(" ");
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