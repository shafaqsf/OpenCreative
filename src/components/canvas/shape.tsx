"use client";

import type { CanvasElement, NodeData, NodeType } from "@/types/canvas";
import { isNodeTool } from "@/types/canvas";
import { getBounds } from "@/lib/canvas/hit-test";

const NODE_COLORS: Record<NodeType, string> = {
  script: "#f5f5f4",
  source: "#f5f5f4",
  generate: "#ffffff",
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
      if (isNodeTool(element.type) && element.nodeData) {
        shape = <WorkflowNode element={element} nodeData={element.nodeData} />;
      }
      break;
  }

  return <g>{shape}</g>;
}

function WorkflowNode({
  element,
  nodeData,
}: {
  element: CanvasElement;
  nodeData: NodeData;
}) {
  const { minX, minY, w, h } = getBounds(element);
  const { nodeType, label, status, outputUrl, error } = nodeData;
  const strokeColor =
    status === "error" ? "#dc2626" : status === "running" ? "#2563eb" : element.stroke;

  return (
    <g>
      <rect
        x={minX}
        y={minY}
        width={w}
        height={h}
        rx={8}
        fill={NODE_COLORS[nodeType]}
        stroke={strokeColor}
        strokeWidth={element.strokeWidth}
      />

      <foreignObject x={minX} y={minY} width={w} height={h}>
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            fontSize: 11,
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            color: "#171717",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 8px 4px",
              fontWeight: 600,
              fontSize: 10,
              opacity: 0.7,
            }}
          >
            {label}
          </div>

          {status === "running" && (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                fontSize: 10,
                opacity: 0.6,
              }}
            >
              Running…
            </div>
          )}

          {status === "error" && (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 8px",
                fontSize: 9,
                color: "#dc2626",
                textAlign: "center",
                wordBreak: "break-word",
              }}
            >
              {error || "Error"}
            </div>
          )}

          {status === "done" && outputUrl && (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 4px 4px",
              }}
            >
              <img
                src={outputUrl}
                alt=""
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                  borderRadius: 4,
                }}
              />
            </div>
          )}

          {status === "done" && !outputUrl && (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                opacity: 0.4,
              }}
            >
              Done
            </div>
          )}

          {status === "idle" && (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                opacity: 0.4,
              }}
            >
              {nodeType === "generate" ? "Set prompt and run" : "Ready"}
            </div>
          )}
        </div>
      </foreignObject>

      <g stroke="#171717" strokeWidth={2}>
        <circle
          cx={minX}
          cy={minY + h / 2}
          r={5}
          fill="#ffffff"
          className="cursor-crosshair"
        />
        <circle
          cx={minX + w}
          cy={minY + h / 2}
          r={5}
          fill="#ffffff"
          className="cursor-crosshair"
        />
      </g>
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