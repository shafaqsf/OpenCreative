"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { CanvasProvider } from "@/lib/canvas/context";
import { updateProjectWorkflow } from "@/lib/projects/service";
import { Canvas } from "@/components/canvas/canvas";
import { ZoomControls } from "@/components/canvas/zoom-controls";
import { ToolsPanel } from "@/components/dashboard/panels/tools-panel";
import { LayersPanel } from "@/components/dashboard/panels/layers-panel";
import type { Project } from "@/lib/projects/service";

export function ProjectCanvasEditor({ project }: { project: Project }) {
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (state: { elements: Parameters<typeof updateProjectWorkflow>[1]["elements"]; camera: Parameters<typeof updateProjectWorkflow>[1]["camera"] }) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          await updateProjectWorkflow(project.id, state);
        } finally {
          setSaving(false);
        }
      }, 800);
    },
    [project.id]
  );

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  return (
    <CanvasProvider initial={project.workflow} onChange={handleChange}>
      <div className="flex h-dvh w-dvw flex-col overflow-hidden bg-white text-neutral-900">
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex size-8 items-center justify-center rounded-md hover:bg-neutral-100"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <h1 className="text-sm font-semibold">{project.name}</h1>
              <p className="text-xs text-neutral-500">Build your workflow</p>
            </div>
          </div>
          {saving && (
            <span className="flex items-center gap-1.5 text-xs text-neutral-400">
              <Loader2 className="size-3 animate-spin" />
              Saving…
            </span>
          )}
        </header>

        <div className="flex flex-1 overflow-hidden">
          <aside className="w-56 overflow-y-auto border-r border-neutral-200 bg-neutral-50">
            <ToolsPanel />
            <LayersPanel />
          </aside>

          <main className="relative flex-1 overflow-hidden bg-neutral-100">
            <Canvas />
            <ZoomControls />
          </main>
        </div>
      </div>
    </CanvasProvider>
  );
}