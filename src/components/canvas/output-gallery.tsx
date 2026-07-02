"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Images, Download, ChevronDown, Eye } from "lucide-react";
import { useCanvas } from "@/lib/canvas/context";
import { listGeneratedMedia } from "@/lib/projects/client-service";
import type { GeneratedMedia } from "@/lib/projects/service";

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
      if ((el.type !== "generate" && el.type !== "output") || !el.nodeData?.outputUrls) continue;
      el.nodeData.outputUrls.forEach((url, i) => {
        if (seen.has(url)) return;
        items.push({
          url,
          nodeId: el.id,
          nodeLabel: el.customLabel || el.nodeData?.label || (el.type === "output" ? "Output" : "Generate"),
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
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function downloadAs(url: string, format: string, label: string, index: number) {
    setDownloadUrl(null);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      if (blob.type.startsWith("video/")) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${label.replace(/\s+/g, "_")}_${index + 1}.${blob.type.split("/")[1] || "mp4"}`;
        a.click();
        URL.revokeObjectURL(a.href);
        return;
      }
      const img = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      img.close();
      const mime: Record<string, string> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };
      const ext = format === "jpeg" ? "jpg" : format;
      canvas.toBlob((converted) => {
        if (converted) {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(converted);
          a.download = `${label.replace(/\s+/g, "_")}_${index + 1}.${ext}`;
          a.click();
          URL.revokeObjectURL(a.href);
        }
      }, mime[format]);
    } catch {
      window.open(url, "_blank");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-6xl flex-col rounded-xl border border-neutral-200 bg-white shadow-2xl"
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {outputs.map((out, i) => (
              <div
                key={`${out.nodeId}-${i}`}
                className="group relative rounded-lg border border-neutral-200 bg-neutral-50 p-2 transition-colors hover:border-neutral-300"
              >
                <MediaPreview
                  url={out.url}
                  mediaType={out.mediaType}
                  className="aspect-video w-full rounded-md object-cover"
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-neutral-500">
                    {out.nodeLabel} #{out.index + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="rounded bg-neutral-200 px-1 py-0.5 text-[9px] uppercase text-neutral-500">
                      {out.mediaType}
                    </span>
                    <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => setPreviewUrl(out.url)}
                        className="flex items-center gap-0.5 rounded p-1 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700"
                        title="Preview"
                      >
                        <Eye className="size-3" />
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => setDownloadUrl(downloadUrl === out.url ? null : out.url)}
                          className="flex items-center gap-0.5 rounded p-1 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700"
                        >
                          <Download className="size-3" />
                          <ChevronDown className="size-3" />
                        </button>
                        {downloadUrl === out.url && (
                          <div className="absolute bottom-full right-0 mb-1 w-20 overflow-hidden rounded border border-neutral-200 bg-white shadow-lg">
                            {out.mediaType === "video" ? (
                              <button
                                onClick={() => downloadAs(out.url, "original", out.nodeLabel, out.index)}
                                className="w-full px-2 py-1.5 text-[10px] text-neutral-700 hover:bg-neutral-100"
                              >
                                Original
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => downloadAs(out.url, "png", out.nodeLabel, out.index)}
                                  className="w-full px-2 py-1.5 text-[10px] text-neutral-700 hover:bg-neutral-100"
                                >
                                  PNG
                                </button>
                                <button
                                  onClick={() => downloadAs(out.url, "jpeg", out.nodeLabel, out.index)}
                                  className="w-full px-2 py-1.5 text-[10px] text-neutral-700 hover:bg-neutral-100"
                                >
                                  JPEG
                                </button>
                                <button
                                  onClick={() => downloadAs(out.url, "webp", out.nodeLabel, out.index)}
                                  className="w-full px-2 py-1.5 text-[10px] text-neutral-700 hover:bg-neutral-100"
                                >
                                  WebP
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {previewUrl && (
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-8"
            onClick={() => setPreviewUrl(null)}
          >
            <div className="relative max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setPreviewUrl(null)}
                className="absolute -right-3 -top-3 z-10 flex size-8 items-center justify-center rounded-full bg-white shadow-md hover:bg-neutral-100"
              >
                <X className="size-4" />
              </button>
              {outputs.find((o) => o.url === previewUrl)?.mediaType === "video" ? (
                <video src={previewUrl} controls className="max-h-[80vh] max-w-full rounded-lg" />
              ) : (
                <img src={previewUrl} alt="" className="max-h-[80vh] max-w-full rounded-lg object-contain" />
              )}
            </div>
          </div>
        )}
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
