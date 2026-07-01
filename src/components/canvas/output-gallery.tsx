"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Images, Scale, Download } from "lucide-react";
import { useCanvas } from "@/lib/canvas/context";
import { listGeneratedMedia, type GeneratedMedia } from "@/lib/projects/service";

type OutputItem = {
  url: string;
  nodeId: string;
  nodeLabel: string;
  index: number;
  mediaType: "image" | "video";
  createdAt?: string;
};

export function OutputGalleryButton({ projectId }: { projectId: string }) {
  const { elements } = useCanvas();
  const [open, setOpen] = useState(false);
  const [library, setLibrary] = useState<GeneratedMedia[]>([]);

  useEffect(() => {
    let cancelled = false;
    listGeneratedMedia(projectId)
      .then((items) => {
        if (!cancelled) setLibrary(items);
      })
      .catch(() => {
        if (!cancelled) setLibrary([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, open]);

  const outputs = useMemo(() => {
    const items: OutputItem[] = library.map((item) => ({
      url: item.url,
      nodeId: item.node_id,
      nodeLabel: item.model ?? "Generated media",
      index: item.output_index,
      mediaType: item.media_type,
      createdAt: item.created_at,
    }));
    const seen = new Set(items.map((item) => item.url));
    for (const el of elements) {
      if (el.type !== "generate" || !el.nodeData?.outputUrls) continue;
      el.nodeData.outputUrls.forEach((url, i) => {
        if (seen.has(url)) return;
        items.push({
          url,
          nodeId: el.id,
          nodeLabel: el.customLabel || el.nodeData?.label || "Generate",
          index: i,
          mediaType: (el.nodeData?.properties.outputType as "image" | "video") || "image",
        });
      });
    }
    return items;
  }, [elements, library]);

  if (outputs.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
      >
        <Images className="size-3.5" />
        Gallery ({outputs.length})
      </button>
      {open && <OutputGalleryModal outputs={outputs} onClose={() => setOpen(false)} />}
    </>
  );
}

function OutputGalleryModal({
  outputs,
  onClose,
}: {
  outputs: OutputItem[];
  onClose: () => void;
}) {
  const [compare, setCompare] = useState<string[]>([]);

  function toggleCompare(url: string) {
    setCompare((prev) => {
      if (prev.includes(url)) return prev.filter((u) => u !== url);
      if (prev.length >= 2) return [prev[1], url];
      return [...prev, url];
    });
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-neutral-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <Images className="size-4 text-neutral-500" />
            <h3 className="text-sm font-semibold text-neutral-900">Output Gallery</h3>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500">
              {outputs.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {compare.length === 2 ? (
            <div className="flex h-full flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-medium text-neutral-600">
                  <Scale className="size-3.5" />
                  Comparing {compare.length} outputs
                </span>
                <button
                  onClick={() => setCompare([])}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Clear comparison
                </button>
              </div>
              <div className="grid flex-1 grid-cols-2 gap-3">
                {compare.map((url, i) => (
                  <div key={url} className="relative rounded-lg border border-neutral-200 bg-neutral-50 p-2">
                    <span className="absolute left-3 top-3 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                      {i + 1}
                    </span>
                    <MediaPreview url={url} mediaType="image" className="h-full w-full rounded-md object-contain" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {outputs.map((out, i) => {
                const selected = compare.includes(out.url);
                return (
                  <div
                    key={`${out.nodeId}-${i}`}
                    className={`group relative rounded-lg border bg-neutral-50 p-2 transition-colors ${
                      selected ? "border-blue-500 ring-1 ring-blue-500" : "border-neutral-200 hover:border-neutral-300"
                    }`}
                  >
                    <MediaPreview
                      url={out.url}
                      mediaType={out.mediaType}
                      className="aspect-video w-full rounded-md object-cover"
                    />
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-neutral-500">
                        {out.nodeLabel} #{out.index + 1}
                      </span>
                      <span className="rounded bg-neutral-200 px-1 py-0.5 text-[9px] uppercase text-neutral-500">
                        {out.mediaType}
                      </span>
                    </div>
                    <div className="absolute inset-x-2 bottom-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => toggleCompare(out.url)}
                        className={`flex flex-1 items-center justify-center gap-1 rounded py-1 text-[10px] font-medium transition-colors ${
                          selected
                            ? "bg-blue-600 text-white"
                            : "bg-neutral-900 text-white hover:bg-neutral-800"
                        }`}
                      >
                        <Scale className="size-3" />
                        {selected ? "Selected" : "Compare"}
                      </button>
                      <a
                        href={out.url}
                        download
                        className="flex items-center justify-center rounded bg-neutral-200 p-1 text-neutral-700 hover:bg-neutral-300"
                      >
                        <Download className="size-3" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MediaPreview({
  url,
  mediaType,
  className,
}: {
  url: string;
  mediaType: "image" | "video";
  className: string;
}) {
  if (mediaType === "video") {
    return <video src={url} controls className={className} />;
  }
  return <img src={url} alt="" className={className} />;
}
