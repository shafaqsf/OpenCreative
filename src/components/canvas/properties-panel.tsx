"use client";

import { useCallback } from "react";
import { useCanvas } from "@/lib/canvas/context";
import type { CanvasElement, NodeData, NodeType } from "@/types/canvas";

const NODE_CONFIG = {
  script: {
    label: "Script",
    fields: [{ key: "content", label: "Content", type: "textarea" }],
  },
  source: {
    label: "Source",
    fields: [
      { key: "url", label: "URL", type: "text", placeholder: "Paste media URL" },
      {
        key: "fileType",
        label: "Type",
        type: "select",
        options: [
          { value: "image", label: "Image" },
          { value: "video", label: "Video" },
        ],
      },
    ],
  },
  generate: {
    label: "Generate",
    fields: [
      { key: "prompt", label: "Prompt", type: "textarea", placeholder: "Describe the output…" },
      {
        key: "model",
        label: "Model",
        type: "select",
        options: [
          { value: "kwaivgi/kling-v3.0-pro", label: "Kling 3.0 Pro" },
          { value: "kwaivgi/kling-v3.0-std", label: "Kling 3.0 Standard" },
          { value: "bytedance/seedance-2.0-fast", label: "Seedance 2.0 Fast" },
          { value: "bytedance/seedance-2.0", label: "Seedance 2.0" },
          { value: "minimax/hailuo-2.3", label: "Hailuo 2.3" },
        ],
      },
      { key: "duration", label: "Duration (s)", type: "number" },
    ],
  },
  preview: {
    label: "Preview",
    fields: [],
  },
  export: {
    label: "Export",
    fields: [
      { key: "filename", label: "Filename", type: "text", placeholder: "my-video" },
      {
        key: "format",
        label: "Format",
        type: "select",
        options: [
          { value: "mp4", label: "MP4" },
          { value: "gif", label: "GIF" },
        ],
      },
    ],
  },
} as const;

export function PropertiesPanel() {
  const {
    elements,
    selectedIds,
    connections,
    removeElements,
    removeConnection,
    updateNodeProperties,
  } = useCanvas();

  const selectedEl = elements.find((el) => selectedIds.includes(el.id));
  const nodeData = selectedEl?.nodeData;

  if (!selectedEl || !nodeData) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-neutral-400">
        Select a workflow node to edit its properties
      </div>
    );
  }

  const el = selectedEl;
  const nd = nodeData;
  const cfg = NODE_CONFIG[nd.nodeType];
  const inputConns = connections.filter((c) => c.toId === el.id);
  const inputNodes = elements.filter((el) =>
    inputConns.some((c) => c.fromId === el.id)
  );

  function setField(key: string, value: string) {
    updateNodeProperties(el.id, {
      ...nd.properties,
      [key]: value,
    });
  }

  return (
    <div className="flex flex-col gap-4 p-4 text-xs text-neutral-900">
      <div>
        <h3 className="mb-1 font-semibold text-neutral-900">{cfg.label}</h3>
        <p className="text-[10px] text-neutral-500">
          Status: {nd.status}
        </p>
      </div>

      {inputNodes.length > 0 && (
        <div>
          <span className="mb-1 block font-medium text-neutral-600">
            Connected from
          </span>
          <div className="flex flex-wrap gap-1">
            {inputNodes.map((n) => (
              <span
                key={n.id}
                className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600"
              >
                {n.nodeData?.label || n.id.slice(0, 6)}
              </span>
            ))}
          </div>
        </div>
      )}

      {cfg.fields.map((field: any) => (
        <label key={field.key} className="block">
          <span className="mb-0.5 block font-medium text-neutral-600">
            {field.label}
          </span>
          {field.type === "textarea" ? (
            <textarea
              value={nd.properties[field.key] ?? ""}
              onChange={(e) => setField(field.key, e.target.value)}
              placeholder={field.placeholder}
              rows={3}
              className="w-full rounded-md border border-neutral-200 px-2 py-1.5 text-xs outline-none focus:border-neutral-900"
            />
          ) : field.type === "select" ? (
            <select
              value={nd.properties[field.key] ?? ""}
              onChange={(e) => setField(field.key, e.target.value)}
              className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-neutral-900"
            >
              {field.options?.map((opt: { value: string; label: string }) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : field.type === "number" ? (
            <input
              type="number"
              value={nd.properties[field.key] ?? ""}
              onChange={(e) => setField(field.key, e.target.value)}
              className="w-full rounded-md border border-neutral-200 px-2 py-1.5 text-xs outline-none focus:border-neutral-900"
            />
          ) : (
            <input
              type="text"
              value={nd.properties[field.key] ?? ""}
              onChange={(e) => setField(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="w-full rounded-md border border-neutral-200 px-2 py-1.5 text-xs outline-none focus:border-neutral-900"
            />
          )}
        </label>
      ))}

      {nd.status === "done" && nd.outputUrl && (
        <div>
          <span className="mb-1 block font-medium text-neutral-600">
            Output
          </span>
          <a
            href={nd.outputUrl}
            target="_blank"
            rel="noreferrer"
            className="block break-all rounded border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-[10px] text-blue-600 underline"
          >
            {nd.outputUrl}
          </a>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => removeElements([el.id])}
          className="rounded-md border border-red-200 px-2 py-1 text-[10px] text-red-600 hover:bg-red-50"
        >
          Delete node
        </button>
      </div>

      {inputConns.map((conn) => (
        <button
          key={conn.id}
          onClick={() => removeConnection(conn.id)}
          className="self-start rounded-md border border-neutral-200 px-2 py-1 text-[10px] text-neutral-500 hover:bg-neutral-100"
        >
          Disconnect from {inputNodes.find((n) => n.id === conn.fromId)?.nodeData?.label ?? "node"}
        </button>
      ))}
    </div>
  );
}
