"use client";

import { useRef } from "react";
import { useCanvas } from "@/lib/canvas/context";

const NODE_CONFIG: Record<
  string,
  { label: string; fields: { key: string; label: string; type: string; placeholder?: string; options?: { value: string; label: string }[] }[] }
> = {
  prompt: {
    label: "Prompt",
    fields: [{ key: "content", label: "Content", type: "textarea", placeholder: "Write your prompt…" }],
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
      { key: "duration", label: "Duration (s)", type: "number_min0" },
      { key: "count", label: "Outputs", type: "number_min1" },
    ],
  },
  output: {
    label: "Output",
    fields: [
      { key: "outputIndex", label: "Output index", type: "number" },
    ],
  },
};

const STATUS_BADGE: Record<string, string> = {
  idle: "bg-neutral-100 text-neutral-500",
  running: "bg-blue-50 text-blue-600",
  done: "bg-neutral-900 text-white",
  error: "bg-red-50 text-red-600",
};

const inputCls = "w-full rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-xs outline-none transition-colors focus:border-neutral-900 focus:ring-1 focus:ring-neutral-200";
const selectCls = "w-full rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-xs outline-none transition-colors focus:border-neutral-900 appearance-none";
const textareaCls = "w-full rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-xs outline-none transition-colors focus:border-neutral-900 focus:ring-1 focus:ring-neutral-200 resize-none";

export function PropertiesPanel() {
  const {
    elements,
    selectedIds,
    connections,
    removeElements,
    removeConnection,
    updateNodeProperties,
  } = useCanvas();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedEl = elements.find((el) => selectedIds.includes(el.id));
  const nodeData = selectedEl?.nodeData;

  if (!selectedEl || !nodeData) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <p className="text-xs text-neutral-400 leading-relaxed max-w-40">
          Select a node on the canvas to edit its properties
        </p>
      </div>
    );
  }

  const el = selectedEl;
  const nd = nodeData;
  const cfg = NODE_CONFIG[nd.nodeType] ?? { label: "Node", fields: [] };
  const inputConns = connections.filter((c) => c.toId === el.id);

  function setField(key: string, value: string) {
    updateNodeProperties(el.id, { ...nd.properties, [key]: value });
  }

  async function handleUpload(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (json.url) setField("url", json.url);
    } catch {}
  }

  return (
    <div className="flex flex-col divide-y divide-neutral-100 h-full">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{cfg.label}</h3>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[nd.status] || STATUS_BADGE.idle}`}>
            {nd.status}
          </span>
        </div>
        {inputConns.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {inputConns.map((c) => {
              const n = elements.find((e) => e.id === c.fromId);
              return (
                <span key={c.id} className="inline-flex items-center gap-1 rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[10px] text-neutral-600">
                  {n?.nodeData?.label || n?.customLabel || c.fromId.slice(0, 6)}
                  <button onClick={() => removeConnection(c.id)} className="ml-0.5 text-neutral-400 hover:text-red-500">&times;</button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {cfg.fields.length > 0 && (
        <div className="px-4 py-3 space-y-3">
          {cfg.fields.map((field) => (
            <label key={field.key} className="block">
              <span className="mb-1 block text-[11px] font-medium text-neutral-500">
                {field.label}
              </span>
              {field.type === "textarea" ? (
                <textarea
                  value={nd.properties[field.key] ?? ""}
                  onChange={(e) => setField(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  className={textareaCls}
                />
              ) : field.type === "select" ? (
                <select
                  value={nd.properties[field.key] ?? ""}
                  onChange={(e) => setField(field.key, e.target.value)}
                  className={selectCls}
                >
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : field.type === "number" || field.type === "number_min0" || field.type === "number_min1" ? (
                <input
                  type="number"
                  min={field.type === "number_min0" ? "0" : field.type === "number_min1" ? "1" : undefined}
                  value={nd.properties[field.key] ?? ""}
                  onChange={(e) => setField(field.key, e.target.value)}
                  className={inputCls}
                />
              ) : (
                <input
                  type="text"
                  value={nd.properties[field.key] ?? ""}
                  onChange={(e) => setField(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className={inputCls}
                />
              )}
            </label>
          ))}
        </div>
      )}

      {nd.nodeType === "source" && (
        <div className="px-4 py-3">
          <span className="mb-1 block text-[11px] font-medium text-neutral-500">Upload</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUpload(file); }}
            className="w-full text-xs file:mr-2 file:rounded-md file:border-0 file:bg-neutral-900 file:px-3 file:py-1.5 file:text-[11px] file:font-medium file:text-white hover:file:bg-neutral-800"
          />
        </div>
      )}

      {(nd.outputUrls && nd.outputUrls.length > 0) && (
        <div className="px-4 py-3 flex-1 overflow-y-auto">
          <span className="mb-2 block text-[11px] font-medium text-neutral-500">
            Outputs ({nd.outputUrls.length})
          </span>
          <div className="space-y-1.5">
            {nd.outputUrls.map((url, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border border-neutral-200 p-2">
                <span className="text-[10px] font-medium text-neutral-400 w-5 text-center">{i + 1}</span>
                <a href={url} target="_blank" rel="noreferrer" className="flex-1 truncate text-[10px] text-blue-600 underline decoration-neutral-300 hover:decoration-blue-600">
                  Output {i + 1}
                </a>
                <a href={url} download className="rounded bg-neutral-900 px-2 py-1 text-[10px] font-medium text-white hover:bg-neutral-800">
                  Download
                </a>
              </div>
            ))}
          </div>
          {nd.status === "idle" && (
            <p className="mt-2 text-[10px] text-neutral-400">Run the workflow to generate outputs.</p>
          )}
        </div>
      )}

      <div className="px-4 py-3">
        <button
          onClick={() => removeElements([el.id])}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-red-200 px-3 py-2 text-[11px] font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          Delete node
        </button>
      </div>
    </div>
  );
}
