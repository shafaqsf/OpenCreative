"use client";

import { useRef, useState } from "react";
import { useCanvas } from "@/lib/canvas/context";
import {
  GENERATION_MODELS,
  getGenerationModel,
} from "@/lib/canvas/generation-models";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/toast/context";

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
        options: GENERATION_MODELS.map((model) => ({
          value: model.id,
          label: `${model.label} (${model.outputType})`,
        })),
      },
      { key: "duration", label: "Duration (s)", type: "number_min0" },
    ],
  },
  output: {
    label: "Output",
    fields: [],
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
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

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
  const generationModel =
    nd.nodeType === "generate" ? getGenerationModel(nd.properties.model) : null;
  const fields = cfg.fields.filter(
    (field) =>
      !(
        nd.nodeType === "generate" &&
        field.key === "duration" &&
        generationModel &&
        !generationModel.supportsDuration
      )
  );

  function setField(key: string, value: string) {
    if (nd.nodeType === "generate" && key === "model") {
      const nextModel = getGenerationModel(value);
      const properties = {
        ...nd.properties,
        model: nextModel.id,
        outputType: nextModel.outputType,
      };
      updateNodeProperties(el.id, properties);
      syncConnectedOutputTypes(properties);
      return;
    }

    updateNodeProperties(el.id, { ...nd.properties, [key]: value });
  }

  function syncConnectedOutputTypes(generateProps: Record<string, string>) {
    if (nd.nodeType !== "generate") return;
    const model = getGenerationModel(generateProps.model);
    const outputConnections = connections
      .filter((connection) => connection.fromId === el.id)
      .map((connection) => ({
        connection,
        output: elements.find((item) => item.id === connection.toId && item.type === "output"),
      }))
      .filter((item): item is { connection: { id: string; fromId: string; toId: string }; output: NonNullable<typeof item.output> } =>
        Boolean(item.output)
      );

    outputConnections.forEach(({ output }, index) => {
      if (!output.nodeData) return;
      updateNodeProperties(output.id, {
        ...output.nodeData.properties,
        outputIndex: String(index),
        outputType: model.outputType,
      });
    });
  }

  async function handleUpload(file: File) {
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
      updateNodeProperties(el.id, {
        ...nd.properties,
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
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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

      {generationModel && (
        <div className="space-y-2 px-4 py-3">
          <div>
            <span className="mb-1 block text-[11px] font-medium text-neutral-500">
              Creates
            </span>
            <div className="grid grid-cols-2 gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-1">
              {(["image", "video"] as const).map((type) => (
                <div
                  key={type}
                  className={`rounded px-2 py-1.5 text-center text-[11px] font-medium capitalize ${
                    generationModel.outputType === type
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-400"
                  }`}
                >
                  {type}
                </div>
              ))}
            </div>
          </div>
          <p className="text-[10px] leading-relaxed text-neutral-400">
            Downloads use the media URL returned by the model, so the file format is preserved by the provider.
          </p>
        </div>
      )}

      {fields.length > 0 && (
        <div className="px-4 py-3 space-y-3">
          {fields.map((field) => (
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
              ) : field.type === "readonly" ? (
                <div className="rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-xs font-medium capitalize text-neutral-700">
                  {nd.properties[field.key] || "Auto"}
                </div>
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
            disabled={uploading}
            accept="image/*,video/*"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUpload(file); }}
            className="w-full text-xs file:mr-2 file:rounded-md file:border-0 file:bg-neutral-900 file:px-3 file:py-1.5 file:text-[11px] file:font-medium file:text-white hover:file:bg-neutral-800"
          />
          {uploading && (
            <p className="mt-2 text-[11px] text-neutral-500">Uploading source media...</p>
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
