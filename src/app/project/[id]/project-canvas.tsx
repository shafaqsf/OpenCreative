"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Play } from "lucide-react";
import { CanvasProvider, useCanvas, newNode } from "@/lib/canvas/context";
import { updateProjectWorkflow } from "@/lib/projects/service";
import { useToast } from "@/lib/toast/context";
import { Canvas } from "@/components/canvas/canvas";
import { ZoomControls } from "@/components/canvas/zoom-controls";
import { PropertiesPanel } from "@/components/canvas/properties-panel";
import { ToolsPanel } from "@/components/dashboard/panels/tools-panel";
import { LayersPanel } from "@/components/dashboard/panels/layers-panel";
import { runGeneration } from "@/lib/canvas/run-workflow";
import type { Project } from "@/lib/projects/service";
import type { WorkflowState } from "@/types/canvas";

export function ProjectCanvasEditor({ project }: { project: Project }) {
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { addToast } = useToast();

  const handleChange = useCallback(
    (state: WorkflowState) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          await updateProjectWorkflow(project.id, state);
          addToast({ title: "Saved", message: "Project workflow saved.", variant: "success", duration: 2000 });
        } catch {
          addToast({ title: "Save failed", message: "Could not save project workflow.", variant: "error" });
        } finally {
          setSaving(false);
        }
      }, 600);
    },
    [project.id, addToast]
  );

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  return (
    <CanvasProvider initial={project.workflow} onChange={handleChange}>
      <ProjectCanvasInner project={project} saving={saving} />
    </CanvasProvider>
  );
}

function ProjectCanvasInner({
  project,
  saving,
}: {
  project: Project;
  saving: boolean;
}) {
  const { elements, connections, updateNodeStatus, addElement, addConnection, removeElements, selectedIds } = useCanvas();
  const { addToast } = useToast();
  const [running, setRunning] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Delete" || e.key === "Backspace") {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
        if (selectedIds.length > 0) removeElements(selectedIds);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIds, removeElements]);

  useEffect(() => {
    const nowConnections = connections;
    for (const gen of elements) {
      if (gen.type !== "generate" || !gen.nodeData) continue;
      const count = Math.max(1, parseInt(gen.nodeData.properties.count || "1", 10));

      const outConns = nowConnections.filter((c) => c.fromId === gen.id);
      const existingOut: string[] = outConns
        .map((c) => c.toId)
        .filter((id) => elements.find((e) => e.id === id)?.type === "output");

      const genBounds = { x: gen.x, y: gen.y, w: gen.width, h: gen.height };

      if (existingOut.length > count) {
        const toRemove = existingOut.slice(count);
        removeElements(toRemove);
      } else if (existingOut.length < count) {
        for (let i = existingOut.length; i < count; i++) {
          const outX = genBounds.x + genBounds.w + 60;
          const outY = genBounds.y + i * 80;
          const outEl = newNode("output", outX, outY);
          outEl.nodeData!.properties.outputIndex = String(i);
          addElement(outEl);
          addConnection(gen.id, outEl.id);
        }
      }
    }
  }, [elements, connections, addElement, addConnection, removeElements]);

  async function handleRun() {
    if (running) return;
    setRunning(true);

    const nowElements = elements;
    const nowConnections = connections;
    const getOutputsNow = (nodeId: string) =>
      nowConnections.filter((c) => c.fromId === nodeId).map((c) => c.toId);

    for (const gen of nowElements) {
      if (gen.type !== "generate" || !gen.nodeData) continue;
      const count = Math.max(1, parseInt(gen.nodeData.properties.count || "1", 10));
      const existingOut: string[] = [];

      let outConn = nowConnections.filter((c) => c.fromId === gen.id);
      for (const c of outConn) {
        const t = nowElements.find((e) => e.id === c.toId);
        if (t?.type === "output") existingOut.push(c.toId);
      }

      if (existingOut.length > count) {
        const toRemove = existingOut.slice(count);
        removeElements(toRemove);
      } else if (existingOut.length < count) {
        const genBounds = { x: gen.x, y: gen.y, w: gen.width, h: gen.height };
        for (let i = existingOut.length; i < count; i++) {
          const outX = genBounds.x + genBounds.w + 60;
          const outY = genBounds.y + i * 80;
          const outEl = newNode("output", outX, outY);
          outEl.nodeData!.properties.outputIndex = String(i);
          addElement(outEl);
          addConnection(gen.id, outEl.id);
        }
      }
    }

    const getInputs = (nodeId: string) =>
      connections.filter((c) => c.toId === nodeId).map((c) => c.fromId);

    const getOutputs = (nodeId: string) =>
      connections.filter((c) => c.fromId === nodeId).map((c) => c.toId);

    const getNode = (id: string) => elements.find((el) => el.id === id);

    let anyError = false;
    try {
      const graph = elements.filter((el) => el.nodeData);
      const done = new Set<string>();
      const queue: string[] = [];

      const enqueueIfReady = (nodeId: string) => {
        const inputs = getInputs(nodeId);
        if (inputs.every((i) => done.has(i)) && !done.has(nodeId)) {
          queue.push(nodeId);
        }
      };

      for (const n of graph) {
        const inputs = getInputs(n.id);
        if (inputs.length === 0) {
          done.add(n.id);
          const nd = n.nodeData!;
          if (!nd.outputUrl) {
            updateNodeStatus(n.id, "done", nd.properties.url || nd.properties.content);
          }
        }
      }

      for (const n of graph) {
        if (!done.has(n.id)) enqueueIfReady(n.id);
      }

      while (queue.length > 0) {
        const id = queue.shift()!;
        if (done.has(id)) continue;
        const node = getNode(id);
        if (!node?.nodeData) continue;

        if (node.type === "generate") {
          updateNodeStatus(id, "running");
          const inputIds = getInputs(id);
          const sourceUrl = inputIds
            .map((i) => getNode(i)?.nodeData?.outputUrl)
            .find(Boolean);
          const count = parseInt(node.nodeData.properties.count || "1", 10);
          const allUrls: string[] = [];
          let lastError: string | undefined;

          for (let i = 0; i < count; i++) {
            const result = await runGeneration({
              prompt: node.nodeData.properties.prompt || "",
              model: node.nodeData.properties.model || "kwaivgi/kling-v3.0-pro",
              imageUrl: sourceUrl?.startsWith("http") ? sourceUrl : undefined,
            });
            if (result.url) {
              allUrls.push(result.url);
            } else {
              lastError = result.error || "Generation failed";
              anyError = true;
              break;
            }
          }

          if (allUrls.length > 0) {
            updateNodeStatus(id, "done", allUrls[0], undefined, allUrls);
          } else {
            updateNodeStatus(id, "error", undefined, lastError || "Generation failed");
          }
        } else if (node.type === "output") {
          const inputIds = getInputs(id);
          const genNode = inputIds.length > 0 ? getNode(inputIds[0]) : null;
          const genUrls = genNode?.nodeData?.outputUrls;
          const index = parseInt(node.nodeData.properties.outputIndex || "0", 10);

          if (genUrls && genUrls.length > index) {
            updateNodeStatus(id, "done", genUrls[index]);
          } else {
            updateNodeStatus(id, "error", undefined, "No output at this index");
            anyError = true;
          }
        } else {
          updateNodeStatus(id, "done", node.nodeData.outputUrl);
        }

        done.add(id);

        const outs = getOutputs(id);
        for (const outId of outs) {
          if (!done.has(outId)) {
            const inputs = getInputs(outId);
            if (inputs.every((i) => done.has(i))) {
              queue.push(outId);
            }
          }
        }
      }

      if (anyError) {
        addToast({ title: "Workflow finished", message: "Some nodes encountered errors. Check the output nodes for details.", variant: "warning" });
      } else if (graph.length > 0) {
        addToast({ title: "Workflow complete", message: "All nodes finished successfully.", variant: "success" });
      }
    } catch (err) {
      addToast({
        title: "Workflow failed",
        message: err instanceof Error ? err.message : "An unexpected error occurred.",
        variant: "error",
      });
    } finally {
      setRunning(false);
    }
  }

  return (
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
        <div className="flex items-center gap-2">
          {saving && (
            <span className="flex items-center gap-1.5 text-xs text-neutral-400">
              <Loader2 className="size-3 animate-spin" />
              Saving…
            </span>
          )}
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {running ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" />
            )}
            {running ? "Running…" : "Run"}
          </button>
        </div>
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

        <aside className="w-64 overflow-y-auto border-l border-neutral-200 bg-white">
          <PropertiesPanel />
        </aside>
      </div>
    </div>
  );
}