"use client";

import type { CanvasElement, NodeData, NodeType } from "@/types/canvas";
import { isNodeTool } from "@/types/canvas";
import { getBounds } from "@/lib/canvas/hit-test";
import { useCanvas } from "@/lib/canvas/context";
import { getGenerationModel } from "@/lib/canvas/generation-models";
import { collectGenerateInput, getConnectedOutputIds, getGenerateRunIssue } from "@/lib/canvas/workflow-engine";

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
        <g>
          <rect
            x={minX}
            y={minY}
            width={w}
            height={h}
            fill="transparent"
          />
          <foreignObject
            x={minX}
            y={minY}
            width={Math.max(w, 1)}
            height={Math.max(h, 1)}
            pointerEvents="none"
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                overflow: "hidden",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: "ui-sans-serif, system-ui, sans-serif",
                fontSize: getTextFontSize(element),
                lineHeight: 1.15,
                color: element.text ? element.stroke : "#a3a3a3",
              }}
            >
              {element.text || "Text"}
            </div>
          </foreignObject>
        </g>
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
  const { elements, connections, runWorkflow, selectedIds, updateElement } = useCanvas();

  const sourceUrl = nodeType === "source" ? nodeData.properties.url?.trim() : undefined;
  const selectedOutputIndex = getSelectedOutputIndex(nodeData);
  const displayUrl = outputUrls && outputUrls.length > 0
    ? outputUrls[selectedOutputIndex] ?? outputUrls[0]
    : outputUrl;
  const mediaUrl = sourceUrl || displayUrl;
  const outputType = nodeData.properties.outputType || nodeData.properties.fileType;
  const showMedia =
    Boolean(mediaUrl) &&
    (nodeType === "source" || (nodeType === "output" && (status === "done" || status === "idle")));
  const showVideo =
    outputType === "video" || /\.(mp4|webm|mov)(?:$|\?)/i.test(mediaUrl ?? "");
  const isSelected = selectedIds.includes(element.id);
  const promptContent = nodeType === "prompt" ? nodeData.properties.content?.trim() : "";
  const generationModel = nodeType === "generate" ? getGenerationModel(nodeData.properties.model) : null;
  const generateRunIssue =
    nodeType === "generate" ? getGenerateRunIssue(elements, connections, element.id) : undefined;
  const generateInput =
    nodeType === "generate" ? collectGenerateInput(elements, connections, element.id) : undefined;
  const generateOutputCount =
    nodeType === "generate" ? getConnectedOutputIds(elements, connections, element.id).length : 0;
  const resizeToMedia = (naturalWidth: number, naturalHeight: number) => {
    if ((nodeType !== "source" && nodeType !== "output") || naturalWidth <= 0 || naturalHeight <= 0) return;
    const nextSize = fitMediaNodeSize(naturalWidth, naturalHeight);
    if (Math.abs(Math.abs(element.width) - nextSize.width) < 2 && Math.abs(Math.abs(element.height) - nextSize.height) < 2) {
      return;
    }
    updateElement(element.id, {
      width: element.width < 0 ? -nextSize.width : nextSize.width,
      height: element.height < 0 ? -nextSize.height : nextSize.height,
    });
  };

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
        strokeWidth={strokeW}
      />

      {status === "running" && (
        <rect
          x={minX}
          y={minY}
          width={w}
          height={h}
          rx={8}
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
              letterSpacing: 0,
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
                margin: "0 10px 5px",
                borderRadius: 5,
                background: "#fef2f2",
                padding: "4px 6px",
                fontSize: 9,
                color: "#dc2626",
                lineHeight: 1.25,
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
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "2px 6px 6px",
                gap: 4,
                position: "relative",
              }}
            >
              {showVideo ? (
                <video
                  src={mediaUrl}
                  muted
                  controls={isSelected}
                  onLoadedMetadata={(event) =>
                    resizeToMedia(event.currentTarget.videoWidth, event.currentTarget.videoHeight)
                  }
                  style={{
                    maxWidth: "100%",
                    maxHeight: isSelected && (nodeType === "output" || nodeType === "source") ? "58%" : "100%",
                    objectFit: "contain",
                    borderRadius: 4,
                    flex: 1,
                  }}
                />
              ) : (
                <img
                  src={mediaUrl}
                  alt=""
                  onLoad={(event) =>
                    resizeToMedia(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)
                  }
                  style={{
                    maxWidth: "100%",
                    maxHeight: isSelected && (nodeType === "output" || nodeType === "source") ? "58%" : "100%",
                    objectFit: "contain",
                    borderRadius: 4,
                    flex: 1,
                  }}
                />
              )}
              {nodeType === "output" && outputUrls && outputUrls.length > 1 && (
                <div
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    background: "rgba(0,0,0,0.65)",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 6px",
                    borderRadius: 8,
                    lineHeight: 1.4,
                  }}
                >
                  {outputUrls.length}
                </div>
              )}
              {nodeType === "source" && nodeData.properties.fileName && (
                <div
                  style={{
                    position: "absolute",
                    left: 6,
                    right: 6,
                    bottom: 6,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    borderRadius: 4,
                    background: "rgba(255,255,255,0.86)",
                    color: "#525252",
                    fontSize: 9,
                    fontWeight: 500,
                    padding: "2px 5px",
                  }}
                >
                  {nodeData.properties.fileName}
                </div>
              )}
            </div>
          )}

          {!showMedia && status !== "running" && (
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
                <GenerateNodeControls
                  modelLabel={generationModel?.label ?? "Unknown model"}
                  outputType={generationModel?.outputType ?? "image"}
                  inputReady={Boolean(generateInput?.prompt || generateInput?.mediaUrl)}
                  outputReady={generateOutputCount > 0}
                  issue={generateRunIssue}
                  onRun={() => runWorkflow?.()}
                />
              ) : nodeType === "source" ? (
                <span style={{ fontSize: 10, color: "#a3a3a3", textAlign: "center" }}>
                  No media selected
                </span>
              ) : nodeType === "output" ? (
                <span style={{ fontSize: 10, color: "#a3a3a3" }}>Awaiting result</span>
              ) : nodeType === "prompt" ? (
                <span
                  style={{
                    maxWidth: "100%",
                    color: promptContent ? "#525252" : "#a3a3a3",
                    fontSize: 10,
                    lineHeight: 1.35,
                    overflow: "hidden",
                    textAlign: "center",
                    wordBreak: "break-word",
                  }}
                >
                  {promptContent || "Empty prompt"}
                </span>
              ) : (
                <span style={{ fontSize: 10, color: "#a3a3a3" }}>No source selected</span>
              )}
            </div>
          )}

        </div>
      </foreignObject>

      <g stroke={strokeColor} strokeWidth={1.5}>
        <circle cx={minX} cy={minY + h / 2} r={7} fill="#ffffff" />
        <circle cx={minX} cy={minY + h / 2} r={2.5} fill={strokeColor} stroke="none" />
        <circle cx={minX + w} cy={minY + h / 2} r={7} fill="#ffffff" />
        <circle cx={minX + w} cy={minY + h / 2} r={2.5} fill={strokeColor} stroke="none" />
      </g>
    </g>
  );
}

function GenerateNodeControls({
  modelLabel,
  outputType,
  inputReady,
  outputReady,
  issue,
  onRun,
}: {
  modelLabel: string;
  outputType: string;
  inputReady: boolean;
  outputReady: boolean;
  issue?: string;
  onRun: () => void;
}) {
  const ready = inputReady && outputReady && !issue;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, width: "100%" }}>
      <span style={{ fontSize: 10, color: "#525252", fontWeight: 500, textAlign: "center" }}>
        {modelLabel}
      </span>
      <div style={{ display: "grid", gap: 3, width: "100%" }}>
        <ReadinessRow ready={inputReady} label={inputReady ? "Input ready" : getGenerateIssueLabel(issue ?? "")} />
        <ReadinessRow ready={outputReady} label={outputReady ? "Output connected" : "Connect Output"} />
      </div>
      <span style={{ fontSize: 9, color: "#a3a3a3", textAlign: "center", textTransform: "capitalize" }}>
        Creates {outputType}
      </span>
      {ready && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRun();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            padding: "5px 12px",
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
      )}
    </div>
  );
}

function ReadinessRow({ ready, label }: { ready: boolean; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        color: ready ? "#047857" : "#dc2626",
        fontSize: 9,
        lineHeight: 1.2,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: ready ? "#10b981" : "#ef4444",
          flex: "0 0 auto",
        }}
      />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
    </div>
  );
}

function fitMediaNodeSize(mediaWidth: number, mediaHeight: number) {
  const aspect = mediaWidth / mediaHeight;
  const minWidth = 180;
  const maxWidth = 360;
  const maxMediaHeight = 280;
  const chromeHeight = 44;
  const controlsReserve = 72;

  let width = Math.min(Math.max(mediaWidth, minWidth), maxWidth);
  let mediaHeightForWidth = width / aspect;

  if (mediaHeightForWidth > maxMediaHeight) {
    mediaHeightForWidth = maxMediaHeight;
    width = mediaHeightForWidth * aspect;
  }

  width = Math.max(minWidth, Math.round(width));
  return {
    width,
    height: Math.round(mediaHeightForWidth + chromeHeight + controlsReserve),
  };
}

function getSelectedOutputIndex(nodeData: NodeData) {
  const outputCount = nodeData.outputUrls?.length ?? 0;
  if (outputCount === 0) return 0;
  const parsed = Number.parseInt(nodeData.properties.selectedOutputIndex ?? "0", 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(parsed, 0), outputCount - 1);
}

function getGenerateIssueLabel(issue: string) {
  if (!issue) return "Connect input";
  if (issue.includes("Output")) return "Connect an Output node";
  if (issue.includes("prompt text")) return "Add prompt text";
  if (issue.includes("generated media")) return "Select generated media";
  if (issue.includes("Upload") || issue.includes("media")) return "Upload or paste media";
  return issue.replace(/\.$/, "");
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

function getTextFontSize(element: CanvasElement) {
  const { h } = getBounds(element);
  return Math.max(12, Math.min(96, Math.max(h, 20) * 0.6));
}
