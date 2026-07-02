"use client";

import { useState, type CSSProperties } from "react";
import { Download, Eye, Pencil, Trash2, Upload } from "lucide-react";
import type { CanvasElement, NodeData, NodeType } from "@/types/canvas";
import { isNodeTool } from "@/types/canvas";
import { getBounds } from "@/lib/canvas/hit-test";
import { useCanvas } from "@/lib/canvas/context";
import { getGenerationModel } from "@/lib/canvas/generation-models";
import { getGenerateRunIssue } from "@/lib/canvas/workflow-engine";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/toast/context";

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
  const { elements, connections, runWorkflow, selectedIds, updateNodeProperties } = useCanvas();

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
              {isSelected && nodeType === "source" && (
                <div style={{ width: "100%" }}>
                  <SourceMediaActions elementId={element.id} nodeData={nodeData} url={mediaUrl} />
                </div>
              )}
              {isSelected && nodeType === "output" && displayUrl && (
                <OutputNodeControls
                  url={displayUrl}
                  outputUrls={outputUrls}
                  nodeData={nodeData}
                  elementId={element.id}
                  index={selectedOutputIndex}
                />
              )}
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
                <>
                  <span style={{ fontSize: 10, color: "#525252", fontWeight: 500, textAlign: "center" }}>
                    {generationModel?.label}
                  </span>
                  <span style={{ fontSize: 10, color: "#a3a3a3", textTransform: "capitalize" }}>
                    {generationModel?.outputType}
                  </span>
                  {generateRunIssue ? (
                    <span style={{ fontSize: 9, color: "#dc2626", textAlign: "center", lineHeight: 1.25 }}>
                      {getGenerateIssueLabel(generateRunIssue)}
                    </span>
                  ) : (
                    <button
                      type="button"
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
                  )}
                </>
              ) : nodeType === "source" ? (
                <SourceNodeControls elementId={element.id} nodeData={nodeData} compact />
              ) : nodeType === "output" ? (
                <span style={{ fontSize: 10, color: "#a3a3a3" }}>Awaiting result</span>
              ) : nodeType === "prompt" ? (
                isSelected ? (
                  <PromptNodeEditor
                    value={nodeData.properties.content ?? ""}
                    onChange={(content) =>
                      updateNodeProperties(element.id, {
                        ...nodeData.properties,
                        content,
                      })
                    }
                  />
                ) : (
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
                )
              ) : (
                <span style={{ fontSize: 10, color: "#a3a3a3" }}>No source selected</span>
              )}
            </div>
          )}

          {status === "done" && nodeType === "generate" && (
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
                type="button"
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
        <circle cx={minX} cy={minY + h / 2} r={7} fill="#ffffff" />
        <circle cx={minX} cy={minY + h / 2} r={2.5} fill={strokeColor} stroke="none" />
        <circle cx={minX + w} cy={minY + h / 2} r={7} fill="#ffffff" />
        <circle cx={minX + w} cy={minY + h / 2} r={2.5} fill={strokeColor} stroke="none" />
      </g>
    </g>
  );
}

function PromptNodeEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Write prompt..."
      style={{
        width: "100%",
        minHeight: 48,
        resize: "none",
        border: "1px solid #e5e5e5",
        borderRadius: 6,
        padding: "6px 7px",
        color: "#262626",
        background: "#fff",
        outline: "none",
        fontSize: 10,
        lineHeight: 1.35,
      }}
    />
  );
}

function SourceNodeControls({
  elementId,
  nodeData,
  compact = false,
}: {
  elementId: string;
  nodeData: NodeData;
  compact?: boolean;
}) {
  const { updateNodeProperties } = useCanvas();
  const { addToast } = useToast();
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    const mediaType = file.type.startsWith("video/") ? "video" : "image";
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const key = `uploads/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    setUploading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("assets")
        .upload(key, file, { contentType: file.type || undefined, upsert: false });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from("assets").getPublicUrl(key);
      updateNodeProperties(elementId, {
        ...nodeData.properties,
        url: data.publicUrl,
        fileType: mediaType,
        fileName: file.name,
      });
      addToast({
        title: "Source uploaded",
        message: `${file.name} is ready on the canvas.`,
        variant: "success",
      });
    } catch (err) {
      addToast({
        title: "Upload failed",
        message: err instanceof Error ? err.message : "Could not upload this file.",
        variant: "error",
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, width: "100%" }}>
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          borderRadius: 6,
          background: "#171717",
          color: "#fff",
          padding: compact ? "5px 8px" : "6px 10px",
          fontSize: 10,
          fontWeight: 600,
          cursor: uploading ? "default" : "pointer",
          opacity: uploading ? 0.6 : 1,
        }}
      >
        <Upload size={11} />
        {uploading ? "Uploading..." : "Upload media"}
        <input
          type="file"
          accept="image/*,video/*"
          disabled={uploading}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) upload(file);
          }}
          style={{ display: "none" }}
        />
      </label>
      <input
        value={nodeData.properties.url ?? ""}
        onChange={(event) =>
          updateNodeProperties(elementId, {
            ...nodeData.properties,
            url: event.target.value,
            fileName: nodeData.properties.fileName || "",
          })
        }
        placeholder="Paste media URL"
        style={{
          width: "100%",
          minWidth: 0,
          border: "1px solid #e5e5e5",
          borderRadius: 5,
          padding: "4px 6px",
          color: "#525252",
          fontSize: 9,
          outline: "none",
        }}
      />
    </div>
  );
}

function SourceMediaActions({
  elementId,
  nodeData,
  url,
}: {
  elementId: string;
  nodeData: NodeData;
  url?: string;
}) {
  const { updateNodeProperties } = useCanvas();

  return (
    <div style={{ display: "flex", gap: 4, width: "100%" }}>
      <button
        onClick={() => url && window.open(url, "_blank")}
        disabled={!url}
        style={mediaActionButtonStyle}
        title="Open source media"
      >
        <Eye size={10} />
        Open
      </button>
      <button
        onClick={() =>
          updateNodeProperties(elementId, {
            ...nodeData.properties,
            url: "",
            fileName: "",
          })
        }
        style={{ ...mediaActionButtonStyle, color: "#dc2626" }}
        title="Clear source media"
      >
        <Trash2 size={10} />
        Clear
      </button>
    </div>
  );
}

const mediaActionButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 3,
  flex: 1,
  border: "1px solid #e5e5e5",
  borderRadius: 4,
  background: "#fff",
  color: "#525252",
  padding: "3px 5px",
  fontSize: 10,
  fontWeight: 600,
  cursor: "pointer",
};

function getSelectedOutputIndex(nodeData: NodeData) {
  const outputCount = nodeData.outputUrls?.length ?? 0;
  if (outputCount === 0) return 0;
  const parsed = Number.parseInt(nodeData.properties.selectedOutputIndex ?? "0", 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(parsed, 0), outputCount - 1);
}

function getGenerateIssueLabel(issue: string) {
  if (issue.includes("output node before")) return "Connect Output";
  if (issue.includes("prompt node")) return "Add Prompt Text";
  if (issue.includes("source node")) return "Add Source Media";
  if (issue.includes("connected output")) return "Select Output Media";
  return "Connect Input";
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

function OutputNodeControls({
  url,
  outputUrls,
  nodeData,
  elementId,
  index,
}: {
  url: string;
  outputUrls?: string[];
  nodeData: NodeData;
  elementId: string;
  index: number;
}) {
  const { updateElement, updateNodeProperties } = useCanvas();
  const fmtKey = `fmt_${index}`;
  const nameKey = `name_${index}`;
  const options = outputUrls && outputUrls.length > 0 ? outputUrls : [url];
  const isVideo = nodeData.properties.outputType === "video";
  const format = nodeData.properties[fmtKey] || (isVideo ? "mp4" : "png");
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(nodeData.properties[nameKey] || "");
  const fileName = `${nodeData.properties[nameKey] || `output-${index + 1}`}.${format}`;

  function selectOutput(nextIndex: number) {
    updateNodeProperties(elementId, {
      ...nodeData.properties,
      selectedOutputIndex: String(nextIndex),
    });
  }

  function clearSelected() {
    const nextUrls = options.filter((_item, itemIndex) => itemIndex !== index);
    const nextIndex = Math.max(0, Math.min(index, nextUrls.length - 1));
    updateElement(elementId, {
      nodeData: {
        ...nodeData,
        status: nextUrls.length > 0 ? "done" : "idle",
        outputUrl: nextUrls[nextIndex],
        outputUrls: nextUrls.length > 0 ? nextUrls : undefined,
        error: undefined,
        properties: {
          ...nodeData.properties,
          selectedOutputIndex: String(nextIndex),
        },
      },
    });
  }

  function clearAll() {
    updateElement(elementId, {
      nodeData: {
        ...nodeData,
        status: "idle",
        outputUrl: undefined,
        outputUrls: undefined,
        error: undefined,
        properties: {
          ...nodeData.properties,
          selectedOutputIndex: "0",
        },
      },
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
      {options.length > 1 && (
        <div style={{ display: "flex", gap: 3, overflowX: "auto", width: "100%", paddingBottom: 1 }}>
          {options.map((itemUrl, itemIndex) => {
            const itemIsVideo = nodeData.properties.outputType === "video" || /\.(mp4|webm|mov)(?:$|\?)/i.test(itemUrl);
            return (
              <button
                key={`${itemUrl}-${itemIndex}`}
                onClick={() => selectOutput(itemIndex)}
                title={`Use output ${itemIndex + 1} downstream`}
                style={{
                  width: 30,
                  height: 24,
                  flex: "0 0 auto",
                  overflow: "hidden",
                  borderRadius: 4,
                  border: itemIndex === index ? "2px solid #171717" : "1px solid #d4d4d4",
                  padding: 0,
                  background: "#f5f5f5",
                  cursor: "pointer",
                }}
              >
                {itemIsVideo ? (
                  <video src={itemUrl} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <img src={itemUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
              </button>
            );
          })}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 4, width: "100%" }}>
        {options.length > 1 && (
          <select
            value={String(index)}
            onChange={(e) => selectOutput(Number.parseInt(e.target.value, 10))}
            title="Selected media for downstream nodes"
            style={{
              fontSize: 10,
              padding: "1px 4px",
              borderRadius: 4,
              border: "1px solid #e5e5e5",
              background: "#fff",
              outline: "none",
              cursor: "pointer",
              width: 44,
            }}
          >
            {options.map((_item, itemIndex) => (
              <option key={itemIndex} value={itemIndex}>
                {itemIndex + 1}
              </option>
            ))}
          </select>
        )}
        <select
          value={format}
          onChange={(e) => updateNodeProperties(elementId, { ...nodeData.properties, [fmtKey]: e.target.value })}
          style={{
            fontSize: 10,
            padding: "1px 4px",
            borderRadius: 4,
            border: "1px solid #e5e5e5",
            background: "#fff",
            outline: "none",
            cursor: "pointer",
            width: 44,
          }}
          >
          {isVideo ? (
            <>
              <option value="mp4">MP4</option>
              <option value="webm">WebM</option>
              <option value="mov">MOV</option>
            </>
          ) : (
            <>
              <option value="png">PNG</option>
              <option value="jpg">JPG</option>
              <option value="webp">WebP</option>
            </>
          )}
        </select>
        <div style={{ flex: 1, minWidth: 0 }}>
          {renaming ? (
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={() => {
                const trimmed = nameInput.trim();
                updateNodeProperties(elementId, { ...nodeData.properties, [nameKey]: trimmed || `output-${index + 1}` });
                setRenaming(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const trimmed = nameInput.trim();
                  updateNodeProperties(elementId, { ...nodeData.properties, [nameKey]: trimmed || `output-${index + 1}` });
                  setRenaming(false);
                }
                if (e.key === "Escape") { setNameInput(nodeData.properties[nameKey] || ""); setRenaming(false); }
              }}
              placeholder="filename"
              style={{
                width: "100%",
                fontSize: 10,
                padding: "1px 4px",
                borderRadius: 4,
                border: "1px solid #d4d4d4",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          ) : (
            <button
              onClick={() => { setNameInput(nodeData.properties[nameKey] || `output-${index + 1}`); setRenaming(true); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                padding: "1px 4px",
                fontSize: 10,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "#525252",
                width: "100%",
                borderRadius: 4,
              }}
              title="Rename file"
            >
              <Pencil size={10} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {nodeData.properties[nameKey] || `output-${index + 1}`}
              </span>
            </button>
          )}
        </div>
        <button
          onClick={() => window.open(url, "_blank")}
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "2px 6px",
            borderRadius: 4,
            border: "1px solid #e5e5e5",
            background: "#fff",
            color: "#525252",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
          title="Preview"
        >
          <Eye size={10} />
        </button>
        <a
          href={url}
          download={fileName}
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "2px 6px",
            borderRadius: 4,
            background: "#171717",
            color: "#fff",
            textDecoration: "none",
            whiteSpace: "nowrap",
            display: "inline-flex",
            alignItems: "center",
          }}
          title="Download selected media"
        >
          <Download size={10} />
        </a>
      </div>
      <div style={{ display: "flex", gap: 4, width: "100%" }}>
        <button onClick={clearSelected} style={mediaActionButtonStyle}>
          <Trash2 size={10} />
          Clear selected
        </button>
        {options.length > 1 && (
          <button onClick={clearAll} style={{ ...mediaActionButtonStyle, color: "#dc2626" }}>
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

function getTextFontSize(element: CanvasElement) {
  const { h } = getBounds(element);
  return Math.max(12, Math.min(96, Math.max(h, 20) * 0.6));
}
