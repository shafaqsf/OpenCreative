"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  ChevronDown,
  Download,
  Eye,
  GitCompare,
  Images,
  Star,
  X,
  XCircle,
} from "lucide-react";
import { useCanvas } from "@/lib/canvas/context";
import {
  getOutputVersions,
  selectOutputVersion,
  updateOutputVersionReview,
} from "@/lib/canvas/output-versions";
import { listGeneratedMedia } from "@/lib/projects/client-service";
import type { GeneratedMedia } from "@/lib/projects/service";
import type { NodeData, OutputMediaType, OutputReviewState, OutputVersion } from "@/types/canvas";

type GalleryItem = {
  version: OutputVersion;
  nodeId: string;
  nodeLabel: string;
  index: number;
  editable: boolean;
  nodeData?: NodeData;
};

export function OutputGalleryButton({ projectId }: { projectId: string }) {
  const { elements, updateElement } = useCanvas();
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
    const items: GalleryItem[] = [];
    const seen = new Set<string>();
    for (const el of elements) {
      if ((el.type !== "generate" && el.type !== "output") || !el.nodeData) continue;
      const versions = getOutputVersions(el.nodeData, el.id);
      versions.forEach((version, index) => {
        seen.add(version.url);
        items.push({
          version,
          nodeId: el.id,
          nodeLabel: el.customLabel || el.nodeData?.label || (el.type === "output" ? "Output" : "Generate"),
          index,
          editable: true,
          nodeData: el.nodeData,
        });
      });
    }

    library.forEach((item) => {
      if (seen.has(item.url)) return;
      items.push({
        version: {
          id: `library-${item.id}`,
          url: item.url,
          mediaType: item.media_type,
          sourceNodeId: item.node_id,
          operationType: "generated",
          approvalState: "none",
          createdAt: item.created_at ?? new Date().toISOString(),
        },
        nodeId: item.node_id,
        nodeLabel: item.model ?? "Generated media",
        index: item.output_index,
        editable: false,
      });
    });
    return items;
  }, [elements, library]);

  function updateReview(item: GalleryItem, state: OutputReviewState) {
    if (!item.editable || !item.nodeData) return;
    updateElement(item.nodeId, {
      nodeData: updateOutputVersionReview(item.nodeData, item.version.id, state),
    });
  }

  function activateVersion(item: GalleryItem) {
    if (!item.editable || !item.nodeData) return;
    updateElement(item.nodeId, {
      nodeData: selectOutputVersion(item.nodeData, item.version.id),
    });
  }

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
      {open && (
        <OutputGalleryModal
          outputs={outputs}
          onClose={() => setOpen(false)}
          onReview={updateReview}
          onActivate={activateVersion}
        />
      )}
    </>
  );
}

function OutputGalleryModal({
  outputs,
  onClose,
  onReview,
  onActivate,
}: {
  outputs: GalleryItem[];
  onClose: () => void;
  onReview: (item: GalleryItem, state: OutputReviewState) => void;
  onActivate: (item: GalleryItem) => void;
}) {
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const preview = outputs.find((item) => item.version.id === previewId);
  const compared = compareIds
    .map((id) => outputs.find((item) => item.version.id === id))
    .filter((item): item is GalleryItem => Boolean(item));

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      return [...prev.slice(-1), id];
    });
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-6xl flex-col rounded-lg border border-neutral-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <Images className="size-4 text-neutral-500" />
            <h3 className="text-sm font-semibold text-neutral-900">Output Gallery</h3>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500">
              {outputs.length}
            </span>
            {compareIds.length > 0 && (
              <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] text-white">
                Compare {compareIds.length}/2
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X className="size-4" />
          </button>
        </div>

        {compared.length === 2 && (
          <div className="grid grid-cols-2 gap-3 border-b border-neutral-100 bg-neutral-50 p-4">
            {compared.map((item) => (
              <ComparePane key={item.version.id} item={item} />
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {outputs.map((out) => {
              const compared = compareIds.includes(out.version.id);
              return (
                <div
                  key={`${out.nodeId}-${out.version.id}`}
                  className={`group relative rounded-lg border bg-neutral-50 p-2 transition-colors ${
                    compared ? "border-neutral-900" : "border-neutral-200 hover:border-neutral-300"
                  }`}
                >
                  <MediaPreview
                    url={out.version.url}
                    mediaType={out.version.mediaType}
                    className="aspect-video w-full rounded-md object-cover"
                  />
                  <div className="mt-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block truncate text-xs text-neutral-600">
                        {out.nodeLabel} v{out.index + 1}
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge label={out.version.mediaType} />
                        <Badge label={out.version.operationType} />
                        <Badge label={out.version.approvalState} state={out.version.approvalState} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPreviewId(out.version.id)} className="rounded p-1 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700" title="Preview">
                        <Eye className="size-3" />
                      </button>
                      <button onClick={() => toggleCompare(out.version.id)} className="rounded p-1 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700" title="Compare">
                        <GitCompare className="size-3" />
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => setDownloadId(downloadId === out.version.id ? null : out.version.id)}
                          className="flex items-center gap-0.5 rounded p-1 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700"
                          title="Download"
                        >
                          <Download className="size-3" />
                          <ChevronDown className="size-3" />
                        </button>
                        {downloadId === out.version.id && (
                          <DownloadMenu
                            item={out}
                            onDownload={(format) => downloadAs(out.version.url, format, out.nodeLabel, out.index)}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {out.editable && (
                    <div className="mt-2 grid grid-cols-5 gap-1 opacity-100">
                      <IconButton title="Use downstream" onClick={() => onActivate(out)} icon={<Eye className="size-3" />} />
                      <IconButton title="Favorite" onClick={() => onReview(out, "favorite")} icon={<Star className="size-3" />} />
                      <IconButton title="Reject" onClick={() => onReview(out, "rejected")} icon={<XCircle className="size-3" />} />
                      <IconButton title="Approve" onClick={() => onReview(out, "approved")} icon={<BadgeCheck className="size-3" />} />
                      <IconButton title="Final" onClick={() => onReview(out, "final")} icon={<BadgeCheck className="size-3 fill-neutral-900" />} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {preview && (
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-8"
            onClick={() => setPreviewId(null)}
          >
            <div className="relative max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setPreviewId(null)}
                className="absolute -right-3 -top-3 z-10 flex size-8 items-center justify-center rounded-full bg-white shadow-md hover:bg-neutral-100"
              >
                <X className="size-4" />
              </button>
              {preview.version.mediaType === "video" ? (
                <video src={preview.version.url} controls className="max-h-[80vh] max-w-full rounded-lg" />
              ) : (
                <img src={preview.version.url} alt="" className="max-h-[80vh] max-w-full rounded-lg object-contain" />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ComparePane({ item }: { item: GalleryItem }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-2">
      <MediaPreview url={item.version.url} mediaType={item.version.mediaType} className="aspect-video w-full rounded object-contain" />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-neutral-700">{item.nodeLabel} v{item.index + 1}</span>
        <Badge label={item.version.approvalState} state={item.version.approvalState} />
      </div>
    </div>
  );
}

function DownloadMenu({
  item,
  onDownload,
}: {
  item: GalleryItem;
  onDownload: (format: string) => void;
}) {
  return (
    <div className="absolute bottom-full right-0 mb-1 w-24 overflow-hidden rounded border border-neutral-200 bg-white shadow-lg">
      {item.version.mediaType === "video" ? (
        <button onClick={() => onDownload("original")} className="w-full px-2 py-1.5 text-[10px] text-neutral-700 hover:bg-neutral-100">
          Original
        </button>
      ) : (
        <>
          <button onClick={() => onDownload("png")} className="w-full px-2 py-1.5 text-[10px] text-neutral-700 hover:bg-neutral-100">PNG</button>
          <button onClick={() => onDownload("jpeg")} className="w-full px-2 py-1.5 text-[10px] text-neutral-700 hover:bg-neutral-100">JPEG</button>
          <button onClick={() => onDownload("webp")} className="w-full px-2 py-1.5 text-[10px] text-neutral-700 hover:bg-neutral-100">WebP</button>
        </>
      )}
    </div>
  );
}

function IconButton({
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
      className="inline-flex h-7 items-center justify-center rounded border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
    >
      {icon}
    </button>
  );
}

function Badge({ label, state }: { label: string; state?: OutputReviewState }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase ${state ? reviewClass(state) : "bg-neutral-200 text-neutral-500"}`}>
      {label}
    </span>
  );
}

function reviewClass(state: OutputReviewState) {
  if (state === "favorite") return "bg-amber-100 text-amber-700";
  if (state === "rejected") return "bg-red-100 text-red-700";
  if (state === "approved") return "bg-emerald-100 text-emerald-700";
  if (state === "final") return "bg-neutral-900 text-white";
  return "bg-neutral-200 text-neutral-500";
}

async function downloadAs(url: string, format: string, label: string, index: number) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    if (blob.type.startsWith("video/")) {
      downloadBlob(blob, `${safeName(label)}_${index + 1}.${blob.type.split("/")[1] || "mp4"}`);
      return;
    }
    const img = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    img.close();
    const mime: Record<string, string> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };
    const ext = format === "jpeg" ? "jpg" : format;
    canvas.toBlob((converted) => {
      if (converted) downloadBlob(converted, `${safeName(label)}_${index + 1}.${ext}`);
    }, mime[format]);
  } catch {
    window.open(url, "_blank");
  }
}

function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function safeName(value: string) {
  return value.replace(/\s+/g, "_").replace(/[^\w-]/g, "");
}

function MediaPreview({
  url,
  mediaType,
  className,
}: {
  url: string;
  mediaType: OutputMediaType;
  className: string;
}) {
  if (mediaType === "video") {
    return <video src={url} controls className={className} />;
  }
  return <img src={url} alt="" className={className} />;
}
