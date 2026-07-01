"use client";

import type { CanvasElement, NodeData, NodeType } from "@/types/canvas";
import { isNodeTool } from "@/types/canvas";
import { getBounds } from "@/lib/canvas/hit-test";
import { useCanvas } from "@/lib/canvas/context";

const NODE_COLORS: Record<NodeType, string> = {
  prompt: "#fafafa",
  source: "#fafafa",
  generate: "#ffffff",
  output: "#ffffff",
};

const NODE_BORDERS: Record<NodeType, string> = {
  prompt: "#d4d4d4",
  source: "#d4d4d4",
  generate: "#171717",
  output: "#a3a3a3",
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
  const { nodeType, label, status, outputUrl, outputUrls, error } = nodeData;
  const border = NODE_BORDERS[nodeType];
  const strokeColor =
    status === "error" ? "#dc2626" : status === "running" ? "#2563eb" : border;
  const strokeW = status === "running" ? 2 : 1.5;
  const { runWorkflow } = useCanvas();

  const displayUrl = outputUrl || (outputUrls && outputUrls.length > 0 ? outputUrls[0] : undefined);
  const showMedia = (status === "done" || status === "idle") && displayUrl;

  return (
    <g>
      <rect
        x={minX}
        y={minY}
        width={w}
        height={h}
        rx={10}
        fill={NODE_COLORS[nodeType]}
        stroke={strokeColor}
        strokeWidth={strokeW}
      />

      {status === "running" && (
        <rect
          x={minX}
          y={minY}
          width={w}
          height={h}
          rx={10}
          fill="none"
          stroke="#2563eb"
          strokeWidth={1.5}
          strokeDasharray={`${8} ${4}`}
          opacity={0.5}
        />
      )}

      <foreignObject x={minX} y={minY} width={w} height={h}>
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 10px 6px",
              fontSize: 11,
              fontWeight: 600,
              color: "#525252",
              letterSpacing: "0.02em",
            }}
          >
            {element.customLabel || label}
          </div>

          {status === "running" && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                padding: "0 12px",
                color: "#2563eb",
                fontSize: 11,
              }}
            >
              <div>Generating…</div>
              <div
                style={{
                  width: "70%",
                  height: 2,
                  background: "#e5e7eb",
                  borderRadius: 1,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: "60%",
                    background: "#2563eb",
                    animation: "pulse 1.5s infinite",
                  }}
                />
              </div>
            </div>
          )}

          {status === "error" && (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 10px",
                fontSize: 10,
                color: "#dc2626",
                textAlign: "center",
                wordBreak: "break-word",
              }}
            >
              {error || "Failed"}
            </div>
          )}

          {showMedia && (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "2px 6px 6px",
              }}
            >
              <img
                src={displayUrl!}
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

          {!showMedia && status === "idle" && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "0 12px",
              }}
            >
              {nodeType === "generate" ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    runWorkflow?.();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "5px 14px",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#fff",
                    background: "#171717",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    lineHeight: 1,
                  }}
                >
                  Run
                </button>
              ) : nodeType === "output" ? (
                <span style={{ fontSize: 10, color: "#a3a3a3" }}>Awaiting result</span>
              ) : nodeType === "prompt" ? (
                <span style={{ fontSize: 10, color: "#a3a3a3" }}>Text input</span>
              ) : (
                <span style={{ fontSize: 10, color: "#a3a3a3" }}>Media input</span>
              )}
            </div>
          )}

          {status === "done" && !displayUrl && nodeType === "generate" && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "0 12px",
              }}
            >
              <span style={{ fontSize: 10, color: "#525252", fontWeight: 500 }}>
                Done
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  runWorkflow?.();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 10px",
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#525252",
                  background: "#f5f5f4",
                  border: "1px solid #e5e5e4",
                  borderRadius: 4,
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                Re-run
              </button>
            </div>
          )}
        </div>
      </foreignObject>

      <g stroke={strokeColor} strokeWidth={1.5}>
        <circle cx={minX} cy={minY + h / 2} r={5} fill="#ffffff" />
        <circle cx={minX + w} cy={minY + h / 2} r={5} fill="#ffffff" />
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