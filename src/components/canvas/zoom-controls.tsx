"use client";

import { Plus, Minus, Maximize } from "lucide-react";
import { useCanvas } from "@/lib/canvas/context";

export function ZoomControls() {
  const { camera, setCamera } = useCanvas();

  const zoomBy = (factor: number) => {
    setCamera((prev) => ({
      ...prev,
      zoom: Math.min(Math.max(prev.zoom * factor, 0.1), 10),
    }));
  };

  const reset = () => setCamera({ x: 0, y: 0, zoom: 1 });

  return (
    <div className="absolute bottom-4 left-4 flex items-center gap-0.5 rounded-lg border border-neutral-200 bg-white px-1 py-1 shadow-sm">
      <button
        onClick={() => zoomBy(0.8)}
        className="flex size-7 items-center justify-center rounded text-neutral-600 hover:bg-neutral-100"
        title="Zoom out"
      >
        <Minus className="size-3.5" />
      </button>
      <button
        onClick={reset}
        className="min-w-12 rounded px-1 py-1 text-center text-xs font-medium text-neutral-600 hover:bg-neutral-100"
        title="Reset zoom"
      >
        {Math.round(camera.zoom * 100)}%
      </button>
      <button
        onClick={() => zoomBy(1.25)}
        className="flex size-7 items-center justify-center rounded text-neutral-600 hover:bg-neutral-100"
        title="Zoom in"
      >
        <Plus className="size-3.5" />
      </button>
      <div className="mx-0.5 h-4 w-px bg-neutral-200" />
      <button
        onClick={reset}
        className="flex size-7 items-center justify-center rounded text-neutral-600 hover:bg-neutral-100"
        title="Fit to view"
      >
        <Maximize className="size-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
}