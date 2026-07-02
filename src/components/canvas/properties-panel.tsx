"use client";

import { useRef, useState, useTransition } from "react";
import {
  BadgeCheck,
  Download,
  Eye,
  FlipHorizontal2,
  FlipVertical2,
  GitBranch,
  ImagePlus,
  RotateCw,
  Scissors,
  Sparkles,
  Star,
  Trash2,
  Wand2,
  XCircle,
} from "lucide-react";
import { newNode, useCanvas, uid } from "@/lib/canvas/context";
import {
  GENERATION_MODELS,
  getGenerationModel,
} from "@/lib/canvas/generation-models";
import {
  appendOutputVersion,
  getActiveOutputVersion,
  getNodeOutputType,
  getOutputVersions,
  removeOutputVersion,
  selectOutputVersion,
  updateOutputVersionReview,
} from "@/lib/canvas/output-versions";
import { runGeneration } from "@/lib/canvas/run-workflow";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/toast/context";
import type {
  CanvasElement,
  Connection,
  NodeData,
  OutputEditMetadata,
  OutputOperationType,
  OutputReviewState,
  OutputVersion,
} from "@/types/canvas";

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
    renameElement,
    updateElement,
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

    if (nd.nodeType === "source" && key === "url") {
      const trimmed = value.trim();
      updateElement(el.id, {
        nodeData: {
          ...nd,
          status: trimmed ? "done" : "idle",
          outputUrl: trimmed || undefined,
          error: undefined,
          properties: {
            ...nd.properties,
            url: value,
            fileName: trimmed ? nd.properties.fileName || "" : "",
          },
        },
      });
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
      updateElement(el.id, {
        nodeData: {
          ...nd,
          status: "done",
          outputUrl: data.publicUrl,
          error: undefined,
          properties: {
            ...nd.properties,
            url: data.publicUrl,
            fileType: mediaType,
            fileName: file.name,
          },
        },
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
      <div className="space-y-3 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{cfg.label}</h3>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[nd.status] || STATUS_BADGE.idle}`}>
            {nd.status}
          </span>
        </div>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-neutral-500">
            Node label
          </span>
          <input
            type="text"
            value={el.customLabel ?? ""}
            onChange={(event) => renameElement(el.id, event.target.value)}
            placeholder={nd.label}
            className={inputCls}
          />
        </label>
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
        <div className="space-y-3 px-4 py-3">
          {nd.properties.url && (
            <div className="space-y-2">
              <span className="block text-[11px] font-medium text-neutral-500">Preview</span>
              <MediaPreview
                url={nd.properties.url}
                mediaType={(nd.properties.fileType as "image" | "video") || "image"}
              />
              {nd.properties.fileName && (
                <p className="truncate text-[11px] text-neutral-500">{nd.properties.fileName}</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => window.open(nd.properties.url, "_blank")}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-200 px-3 py-2 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  <Eye className="size-3" />
                  Open
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateElement(el.id, {
                      nodeData: {
                        ...nd,
                        status: "idle",
                        outputUrl: undefined,
                        error: undefined,
                        properties: {
                          ...nd.properties,
                          url: "",
                          fileName: "",
                        },
                      },
                    })
                  }
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-red-200 px-3 py-2 text-[11px] font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="size-3" />
                  Clear
                </button>
              </div>
            </div>
          )}
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

      {nd.nodeType === "output" && (
        <OutputNodeEditor elementId={el.id} nodeData={nd} />
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

function OutputNodeEditor({
  elementId,
  nodeData,
}: {
  elementId: string;
  nodeData: NodeData;
}) {
  const { elements, connections, updateElement, updateNodeProperties, addElements } = useCanvas();
  const { addToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [promptDelta, setPromptDelta] = useState("");
  const [edit, setEdit] = useState<OutputEditMetadata>({
    aspectRatio: "original",
    rotation: 0,
    background: "#ffffff",
    text: "",
    shape: "rectangle",
    trimStart: "0",
    trimEnd: "",
    posterFrame: "0",
  });
  const versions = getOutputVersions(nodeData, elementId);
  const activeVersion = getActiveOutputVersion(nodeData, elementId);
  const selectedIndex = Math.max(0, versions.findIndex((version) => version.id === activeVersion?.id));
  const selectedUrl = activeVersion?.url;
  const outputType = activeVersion?.mediaType ?? getNodeOutputType(nodeData);
  const fmtKey = `fmt_${activeVersion?.id ?? selectedIndex}`;
  const nameKey = `name_${activeVersion?.id ?? selectedIndex}`;
  const format = nodeData.properties[fmtKey] || (outputType === "video" ? "mp4" : "png");
  const baseName = nodeData.properties[nameKey] || `output-${selectedIndex + 1}`;
  const fileName = `${baseName}.${format}`;

  function patchNodeData(nextNodeData: NodeData) {
    updateElement(elementId, { nodeData: nextNodeData });
  }

  function updateOutputProperty(key: string, value: string) {
    updateNodeProperties(elementId, {
      ...nodeData.properties,
      [key]: value,
    });
  }

  function clearSelected() {
    if (!activeVersion) return;
    patchNodeData(removeOutputVersion(nodeData, activeVersion.id));
  }

  function clearAll() {
    updateElement(elementId, {
      nodeData: {
        ...nodeData,
        status: "idle",
        outputUrl: undefined,
        outputUrls: undefined,
        outputVersions: undefined,
        activeOutputVersionId: undefined,
        finalOutputVersionId: undefined,
        error: undefined,
        properties: {
          ...nodeData.properties,
          selectedOutputIndex: "0",
        },
      },
    });
  }

  async function createLocalEdit(operationType: OutputOperationType, metadata: OutputEditMetadata) {
    if (!activeVersion) return;
    if (activeVersion.mediaType === "video") {
      patchNodeData(
        appendOutputVersion(nodeData, {
          url: activeVersion.url,
          mediaType: "video",
          parentVersionId: activeVersion.id,
          sourceNodeId: elementId,
          operationType,
          editMetadata: metadata,
        })
      );
      return;
    }

    try {
      const url = await renderImageEdit(activeVersion.url, metadata);
      patchNodeData(
        appendOutputVersion(nodeData, {
          url,
          mediaType: "image",
          parentVersionId: activeVersion.id,
          sourceNodeId: elementId,
          operationType,
          editMetadata: metadata,
        })
      );
      addToast({ title: "Edit created", message: "A new output version is ready.", variant: "success" });
    } catch (err) {
      addToast({
        title: "Edit failed",
        message: err instanceof Error ? err.message : "Could not edit this output.",
        variant: "error",
      });
    }
  }

  function createPromptRefinement(operationType: OutputOperationType, defaultDelta: string) {
    if (!activeVersion) return;
    const delta = promptDelta.trim() || defaultDelta;
    startTransition(async () => {
      const result = await runGeneration({
        prompt: delta,
        model: nodeData.properties.model || getGenerationModel(undefined).id,
        outputType: activeVersion.mediaType,
        imageUrl: activeVersion.mediaType === "image" ? activeVersion.url : undefined,
        duration: nodeData.properties.duration,
      });
      if (!result.url) {
        addToast({
          title: "Refinement unavailable",
          message: result.error || "The provider did not return edited media.",
          variant: "warning",
        });
        return;
      }
      patchNodeData(
        appendOutputVersion(nodeData, {
          url: result.url,
          mediaType: activeVersion.mediaType,
          parentVersionId: activeVersion.id,
          sourceNodeId: elementId,
          operationType,
          promptDelta: delta,
        })
      );
      setPromptDelta("");
      addToast({ title: "Refinement created", message: "A derived output version was added.", variant: "success" });
    });
  }

  function setReview(version: OutputVersion, approvalState: OutputReviewState) {
    patchNodeData(updateOutputVersionReview(nodeData, version.id, approvalState));
  }

  function createSourceFromVersion(version: OutputVersion) {
    const source = newNode("source", 80, 80);
    const sourceNode: CanvasElement = {
      ...source,
      x: 80,
      y: 80,
      nodeData: {
        ...source.nodeData!,
        status: "done",
        outputUrl: version.url,
        properties: {
          ...source.nodeData!.properties,
          url: version.url,
          fileType: version.mediaType,
          fileName: `${version.operationType}-${version.id.slice(-4)}`,
          sourceOutputVersionId: version.id,
        },
      },
    };
    addElements([sourceNode]);
    addToast({ title: "Source created", message: "The selected version is now reusable on the canvas.", variant: "success" });
  }

  function branchFromVersion(version: OutputVersion) {
    const outputElement = elements.find((element) => element.id === elementId);
    const x = outputElement ? outputElement.x + outputElement.width + 80 : 120;
    const y = outputElement ? outputElement.y : 120;
    const source = newNode("source", x, y);
    const generate = newNode("generate", x + 250, y);
    const output = newNode("output", x + 520, y);
    const sourceNode: CanvasElement = {
      ...source,
      nodeData: {
        ...source.nodeData!,
        status: "done",
        outputUrl: version.url,
        properties: {
          ...source.nodeData!.properties,
          url: version.url,
          fileType: version.mediaType,
          sourceOutputVersionId: version.id,
        },
      },
    };
    const generateNode: CanvasElement = {
      ...generate,
      nodeData: {
        ...generate.nodeData!,
        properties: {
          ...generate.nodeData!.properties,
          prompt: `Create a variation from ${version.operationType} output ${version.id}.`,
        },
      },
    };
    const outputNode: CanvasElement = {
      ...output,
      nodeData: {
        ...output.nodeData!,
        properties: {
          ...output.nodeData!.properties,
          outputType: version.mediaType,
          parentOutputVersionId: version.id,
        },
      },
    };
    const newConnections: Connection[] = [
      { id: uid(), fromId: sourceNode.id, toId: generateNode.id },
      { id: uid(), fromId: generateNode.id, toId: outputNode.id },
    ];
    addElements([sourceNode, generateNode, outputNode], newConnections);
    addToast({ title: "Branch created", message: "A variation chain was added beside the output.", variant: "success" });
  }

  function createVariationWorkflow(version: OutputVersion) {
    const outputElement = elements.find((element) => element.id === elementId);
    const x = outputElement ? outputElement.x + outputElement.width + 80 : 120;
    const y = outputElement ? outputElement.y + outputElement.height + 48 : 180;
    const prompt = newNode("prompt", x, y);
    const source = newNode("source", x + 240, y);
    const generate = newNode("generate", x + 480, y);
    const output = newNode("output", x + 750, y);
    const promptNode: CanvasElement = {
      ...prompt,
      nodeData: {
        ...prompt.nodeData!,
        status: "done",
        properties: {
          ...prompt.nodeData!.properties,
          content: `Create a polished variation of the selected ${version.mediaType} while preserving the strongest composition cues.`,
        },
      },
    };
    const sourceNode: CanvasElement = {
      ...source,
      nodeData: {
        ...source.nodeData!,
        status: "done",
        outputUrl: version.url,
        properties: {
          ...source.nodeData!.properties,
          url: version.url,
          fileType: version.mediaType,
          sourceOutputVersionId: version.id,
        },
      },
    };
    const outputNode: CanvasElement = {
      ...output,
      nodeData: {
        ...output.nodeData!,
        properties: {
          ...output.nodeData!.properties,
          outputType: version.mediaType,
          parentOutputVersionId: version.id,
        },
      },
    };
    const newConnections: Connection[] = [
      { id: uid(), fromId: promptNode.id, toId: generate.id },
      { id: uid(), fromId: sourceNode.id, toId: generate.id },
      { id: uid(), fromId: generate.id, toId: outputNode.id },
    ];
    addElements([promptNode, sourceNode, generate, outputNode], newConnections);
    addToast({ title: "Variation workflow created", message: "Prompt, source, generate, and output nodes were added.", variant: "success" });
  }

  if (versions.length === 0 || !selectedUrl || !activeVersion) {
    return (
      <div className="px-4 py-3">
        <p className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-3 py-4 text-center text-xs text-neutral-400">
          Awaiting generated media.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 py-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-neutral-500">Active version</span>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500">
            {selectedIndex + 1} / {versions.length}
          </span>
        </div>
        <MediaPreview url={selectedUrl} mediaType={outputType} />
        <div className="flex flex-wrap gap-1">
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase text-neutral-500">
            {activeVersion.operationType}
          </span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${reviewClass(activeVersion.approvalState)}`}>
            {activeVersion.approvalState}
          </span>
        </div>
      </div>

      {versions.length > 1 && (
        <div className="space-y-2">
          <span className="block text-[11px] font-medium text-neutral-500">
            Versions
          </span>
          <div className="grid grid-cols-4 gap-2">
            {versions.map((version, index) => (
              <button
                key={version.id}
                type="button"
                onClick={() => patchNodeData(selectOutputVersion(nodeData, version.id))}
                className={`overflow-hidden rounded-md border ${
                  index === selectedIndex ? "border-neutral-900" : "border-neutral-200"
                } bg-neutral-50`}
                title={`Use version ${index + 1} downstream`}
              >
                <MediaPreview url={version.url} mediaType={version.mediaType} compact />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <span className="block text-[11px] font-medium text-neutral-500">Review</span>
        <div className="grid grid-cols-5 gap-1">
          <IconAction title="Favorite" onClick={() => setReview(activeVersion, "favorite")} icon={<Star className="size-3" />} />
          <IconAction title="Reject" onClick={() => setReview(activeVersion, "rejected")} icon={<XCircle className="size-3" />} />
          <IconAction title="Approve" onClick={() => setReview(activeVersion, "approved")} icon={<BadgeCheck className="size-3" />} />
          <IconAction title="Final" onClick={() => setReview(activeVersion, "final")} icon={<BadgeCheck className="size-3 fill-neutral-900" />} />
          <IconAction title="Open" onClick={() => window.open(selectedUrl, "_blank")} icon={<Eye className="size-3" />} />
        </div>
      </div>

      {outputType === "image" ? (
        <div className="space-y-3">
          <span className="block text-[11px] font-medium text-neutral-500">Quick edit</span>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={edit.aspectRatio}
              onChange={(event) => setEdit((prev) => ({ ...prev, aspectRatio: event.target.value }))}
              className={selectCls}
            >
              <option value="original">Original</option>
              <option value="1:1">1:1</option>
              <option value="4:5">4:5</option>
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
            </select>
            <input
              value={edit.background}
              onChange={(event) => setEdit((prev) => ({ ...prev, background: event.target.value }))}
              className={inputCls}
              placeholder="#ffffff"
            />
          </div>
          <input
            value={edit.text}
            onChange={(event) => setEdit((prev) => ({ ...prev, text: event.target.value }))}
            className={inputCls}
            placeholder="Overlay text"
          />
          <div className="grid grid-cols-3 gap-1">
            <IconAction title="Crop" onClick={() => createLocalEdit("crop", edit)} icon={<Scissors className="size-3" />} />
            <IconAction title="Rotate" onClick={() => createLocalEdit("rotate", { ...edit, rotation: (edit.rotation ?? 0) + 90 })} icon={<RotateCw className="size-3" />} />
            <IconAction title="Flip X" onClick={() => createLocalEdit("flip", { ...edit, flipX: true })} icon={<FlipHorizontal2 className="size-3" />} />
            <IconAction title="Flip Y" onClick={() => createLocalEdit("flip", { ...edit, flipY: true })} icon={<FlipVertical2 className="size-3" />} />
            <IconAction title="Background" onClick={() => createLocalEdit("background", edit)} icon={<ImagePlus className="size-3" />} />
            <IconAction title="Overlay" onClick={() => createLocalEdit(edit.text ? "text" : "shape", edit)} icon={<Wand2 className="size-3" />} />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <span className="block text-[11px] font-medium text-neutral-500">Video metadata</span>
          <div className="grid grid-cols-3 gap-2">
            <input value={edit.trimStart} onChange={(event) => setEdit((prev) => ({ ...prev, trimStart: event.target.value }))} className={inputCls} placeholder="Start" />
            <input value={edit.trimEnd} onChange={(event) => setEdit((prev) => ({ ...prev, trimEnd: event.target.value }))} className={inputCls} placeholder="End" />
            <input value={edit.posterFrame} onChange={(event) => setEdit((prev) => ({ ...prev, posterFrame: event.target.value }))} className={inputCls} placeholder="Poster" />
          </div>
          <button type="button" onClick={() => createLocalEdit("trim", edit)} className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-neutral-200 px-3 py-2 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50">
            <Scissors className="size-3" />
            Save video edit
          </button>
        </div>
      )}

      <div className="space-y-2">
        <span className="block text-[11px] font-medium text-neutral-500">AI refinement</span>
        <textarea
          value={promptDelta}
          onChange={(event) => setPromptDelta(event.target.value)}
          className={textareaCls}
          rows={2}
          placeholder="Optional edit instruction"
        />
        <div className="grid grid-cols-2 gap-1">
          {REFINEMENT_ACTIONS.map((action) => (
            <button
              key={action.type}
              type="button"
              disabled={pending}
              onClick={() => createPromptRefinement(action.type, action.prompt)}
              className="inline-flex items-center justify-center gap-1 rounded-md border border-neutral-200 px-2 py-1.5 text-[10px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            >
              <Sparkles className="size-3" />
              {action.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <span className="block text-[11px] font-medium text-neutral-500">Reuse</span>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => createSourceFromVersion(activeVersion)} className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-200 px-3 py-2 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50">
            <ImagePlus className="size-3" />
            Source
          </button>
          <button type="button" onClick={() => branchFromVersion(activeVersion)} className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-200 px-3 py-2 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50">
            <GitBranch className="size-3" />
            Branch
          </button>
          <button type="button" onClick={() => createVariationWorkflow(activeVersion)} className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-200 px-3 py-2 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50">
            <Sparkles className="size-3" />
            Variation
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_88px] gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-neutral-500">
            File name
          </span>
          <input
            value={baseName}
            onChange={(event) => updateOutputProperty(nameKey, event.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-neutral-500">
            Format
          </span>
          <select
            value={format}
            onChange={(event) => updateOutputProperty(fmtKey, event.target.value)}
            className={selectCls}
          >
            {outputType === "video" ? (
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
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => window.open(selectedUrl, "_blank")}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-200 px-3 py-2 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <Eye className="size-3" />
          Open
        </button>
        <a
          href={selectedUrl}
          download={fileName}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-neutral-900 px-3 py-2 text-[11px] font-medium text-white hover:bg-neutral-800"
        >
          <Download className="size-3" />
          Download
        </a>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={clearSelected}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-200 px-3 py-2 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <Trash2 className="size-3" />
          Clear selected
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-red-200 px-3 py-2 text-[11px] font-medium text-red-600 hover:bg-red-50"
        >
          Clear all
        </button>
      </div>
    </div>
  );
}

const REFINEMENT_ACTIONS: { type: OutputOperationType; label: string; prompt: string }[] = [
  { type: "upscale", label: "Upscale", prompt: "Upscale this output while preserving the composition and visual identity." },
  { type: "remove-background", label: "Remove bg", prompt: "Remove the background and keep the main subject cleanly isolated." },
  { type: "erase", label: "Erase", prompt: "Remove distracting elements while keeping the rest of the image natural." },
  { type: "inpaint", label: "Inpaint", prompt: "Fill missing or rough areas with coherent visual detail." },
  { type: "restyle", label: "Restyle", prompt: "Restyle this output with a polished editorial look." },
  { type: "similar", label: "Similar", prompt: "Generate a close variation of this output with the same subject and layout." },
];

function IconAction({
  title,
  icon,
  onClick,
}: {
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="inline-flex h-8 items-center justify-center rounded-md border border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
    >
      {icon}
    </button>
  );
}

function reviewClass(state: OutputReviewState) {
  if (state === "favorite") return "bg-amber-100 text-amber-700";
  if (state === "rejected") return "bg-red-100 text-red-700";
  if (state === "approved") return "bg-emerald-100 text-emerald-700";
  if (state === "final") return "bg-neutral-900 text-white";
  return "bg-neutral-100 text-neutral-500";
}

async function renderImageEdit(url: string, metadata: OutputEditMetadata) {
  const image = await loadImage(url);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const crop = getCropRect(sourceWidth, sourceHeight, metadata.aspectRatio);
  const rotation = ((metadata.rotation ?? 0) % 360 + 360) % 360;
  const rotated = rotation === 90 || rotation === 270;
  const canvas = document.createElement("canvas");
  canvas.width = rotated ? crop.height : crop.width;
  canvas.height = rotated ? crop.width : crop.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas editing is not available in this browser.");

  ctx.fillStyle = metadata.background || "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(metadata.flipX ? -1 : 1, metadata.flipY ? -1 : 1);
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, -crop.width / 2, -crop.height / 2, crop.width, crop.height);
  ctx.restore();

  if (metadata.shape) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(4, Math.round(canvas.width * 0.01));
    const margin = Math.round(Math.min(canvas.width, canvas.height) * 0.08);
    if (metadata.shape === "ellipse") {
      ctx.beginPath();
      ctx.ellipse(canvas.width / 2, canvas.height / 2, canvas.width / 2 - margin, canvas.height / 2 - margin, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeRect(margin, margin, canvas.width - margin * 2, canvas.height - margin * 2);
    }
  }

  if (metadata.text?.trim()) {
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 4;
    ctx.font = `700 ${Math.max(24, Math.round(canvas.width * 0.055))}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    const text = metadata.text.trim();
    const x = canvas.width / 2;
    const y = canvas.height - Math.round(canvas.height * 0.08);
    ctx.strokeText(text, x, y, canvas.width * 0.9);
    ctx.fillText(text, x, y, canvas.width * 0.9);
  }

  return canvas.toDataURL("image/png");
}

function getCropRect(width: number, height: number, ratio?: string) {
  if (!ratio || ratio === "original") return { x: 0, y: 0, width, height };
  const [rw, rh] = ratio.split(":").map(Number);
  if (!rw || !rh) return { x: 0, y: 0, width, height };
  const target = rw / rh;
  const current = width / height;
  if (current > target) {
    const nextWidth = Math.round(height * target);
    return { x: Math.round((width - nextWidth) / 2), y: 0, width: nextWidth, height };
  }
  const nextHeight = Math.round(width / target);
  return { x: 0, y: Math.round((height - nextHeight) / 2), width, height: nextHeight };
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The image could not be loaded for editing."));
    image.src = url;
  });
}

function MediaPreview({
  url,
  mediaType,
  compact = false,
}: {
  url: string;
  mediaType: "image" | "video";
  compact?: boolean;
}) {
  const className = compact
    ? "aspect-square w-full object-cover"
    : "aspect-video w-full rounded-md border border-neutral-200 bg-neutral-100 object-contain";
  if (mediaType === "video" || /\.(mp4|webm|mov)(?:$|\?)/i.test(url)) {
    return <video src={url} muted controls={!compact} className={className} />;
  }
  return <img src={url} alt="" className={className} />;
}

function getSelectedOutputIndex(nodeData: NodeData) {
  const outputCount = nodeData.outputUrls?.length ?? 0;
  if (outputCount === 0) return 0;
  const parsed = Number.parseInt(nodeData.properties.selectedOutputIndex ?? "0", 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(parsed, 0), outputCount - 1);
}
