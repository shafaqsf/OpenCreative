"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ResizableHandle,
  useResizablePanel,
} from "@/components/ui/resizable-handle";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Play,
  MousePointer2,
  Square,
  Circle,
  Minus,
  ArrowRight,
  Type,
  PenLine,
  Triangle,
  Diamond,
  Star,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Monitor,
  RotateCcw,
  Redo,
  Trash2,
  Copy,
  ZoomIn,
  Maximize,
  Grid3X3,
  Magnet,
  Save,
  Bell,
  BellOff,
} from "lucide-react";
import { CanvasProvider, useCanvas, newNode, uid } from "@/lib/canvas/context";
import { saveGeneratedMedia, updateProjectWorkflow } from "@/lib/projects/service";
import { useToast } from "@/lib/toast/context";
import { Canvas } from "@/components/canvas/canvas";
import { ZoomControls } from "@/components/canvas/zoom-controls";
import { AlignToolbar } from "@/components/canvas/align-toolbar";
import { MiniMap } from "@/components/canvas/mini-map";
import { OutputGalleryButton } from "@/components/canvas/output-gallery";
import { PropertiesPanel } from "@/components/canvas/properties-panel";
import { AIPanel } from "@/components/dashboard/panels/ai-panel";
import { ToolsPanel } from "@/components/dashboard/panels/tools-panel";
import { runGeneration } from "@/lib/canvas/run-workflow";
import { getGenerationModel, normalizeOutputCount } from "@/lib/canvas/generation-models";
import { useKeyboardShortcuts } from "@/lib/canvas/use-keyboard-shortcuts";
import { useRegisterCommands } from "@/lib/command-palette/context";
import type { Project } from "@/lib/projects/service";
import type { WorkflowState } from "@/types/canvas";

export function ProjectCanvasEditor({ project }: { project: Project }) {
  const [saving, setSaving] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveRef = useRef(autoSave);
  autoSaveRef.current = autoSave;
  const latestStateRef = useRef<WorkflowState | null>(null);
  const { addToast } = useToast();

  const handleChange = useCallback(
    (state: WorkflowState) => {
      latestStateRef.current = state;
      if (!autoSaveRef.current) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          await updateProjectWorkflow(project.id, state);
        } catch {
          addToast({ title: "Save failed", message: "Could not save project workflow.", variant: "error" });
        } finally {
          setSaving(false);
        }
      }, 600);
    },
    [project.id, addToast]
  );

  const manualSave = useCallback(async () => {
    if (!latestStateRef.current) return;
    setSaving(true);
    try {
      await updateProjectWorkflow(project.id, latestStateRef.current);
      addToast({ title: "Saved", message: "Project saved successfully.", variant: "success" });
    } catch {
      addToast({ title: "Save failed", message: "Could not save project workflow.", variant: "error" });
    } finally {
      setSaving(false);
    }
  }, [project.id, addToast]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  return (
    <CanvasProvider initial={project.workflow} onChange={handleChange}>
      <ProjectCanvasInner
        project={project}
        saving={saving}
        autoSave={autoSave}
        onToggleAutoSave={setAutoSave}
        onManualSave={manualSave}
      />
    </CanvasProvider>
  );
}

function ProjectCanvasInner({
  project,
  saving,
  autoSave,
  onToggleAutoSave,
  onManualSave,
}: {
  project: Project;
  saving: boolean;
  autoSave: boolean;
  onToggleAutoSave: (value: boolean) => void;
  onManualSave: () => void;
}) {
  const {
    elements,
    connections,
    updateNodeStatus,
    addElements,
    removeElements,
    selectedIds,
    setActiveTool,
    setCamera,
    undo,
    redo,
    canUndo,
    canRedo,
    duplicateSelection,
    toggleSnapToGrid,
    toggleShowGrid,
    alignSelection,
    distributeSelection,
    setRunWorkflow,
  } = useCanvas();
  const { addToast } = useToast();
  const [running, setRunning] = useState(false);
  const leftPanel = useResizablePanel("left", 224, { min: 180, max: 360 });
  const rightPanel = useResizablePanel("right", 256, { min: 200, max: 400 });

  useKeyboardShortcuts();

  const handleRun = useCallback(async () => {
    if (running) return;
    setRunning(true);

    const nowElements = [...elements];
    const nowConnections = [...connections];
    const newElements: typeof nowElements = [];
    const newConnections: typeof nowConnections = [];
    const runOutputIds = new Map<string, string[]>();

    for (const gen of nowElements) {
      if (gen.type !== "generate" || !gen.nodeData) continue;
      const model = getGenerationModel(gen.nodeData.properties.model);
      const count = normalizeOutputCount(gen.nodeData.properties.count, model.id);
      const existingOutputIds = nowConnections
        .filter((conn) => {
          if (conn.fromId !== gen.id) return false;
          return nowElements.some((el) => el.id === conn.toId && el.type === "output");
        })
        .map((conn) => conn.toId);

      const allOutputIds = [...existingOutputIds];
      for (let i = existingOutputIds.length; i < count; i++) {
        const out = newNode("output", gen.x + gen.width + 60, gen.y + i * 120);
        out.nodeData!.properties.outputIndex = String(i);
        out.nodeData!.properties.outputType = model.outputType;
        const conn = { id: uid(), fromId: gen.id, toId: out.id };
        nowElements.push(out);
        nowConnections.push(conn);
        newElements.push(out);
        newConnections.push(conn);
        allOutputIds.push(out.id);
      }

      existingOutputIds.forEach((outputId, index) => {
        const output = nowElements.find((el) => el.id === outputId && el.nodeData);
        if (!output?.nodeData) return;
        output.nodeData = {
          ...output.nodeData,
          properties: {
            ...output.nodeData.properties,
            outputIndex: String(index),
            outputType: model.outputType,
          },
        };
      });
      runOutputIds.set(gen.id, allOutputIds);
    }
    if (newElements.length > 0) addElements(newElements, newConnections);

    const getInputs = (nodeId: string) =>
      nowConnections.filter((c) => c.toId === nodeId).map((c) => c.fromId);

    const getOutputs = (nodeId: string) =>
      nowConnections.filter((c) => c.fromId === nodeId).map((c) => c.toId);

    const getNode = (id: string) => nowElements.find((el) => el.id === id);

    let anyError = false;
    try {
      const graph = nowElements.filter((el) => el.nodeData);
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
          const inputPrompt = inputIds
            .map((i) => getNode(i)?.nodeData)
            .filter((node) => node?.nodeType === "prompt")
            .map((node) => node?.properties.content)
            .filter(Boolean)
            .join("\n");
          const prompt = inputPrompt.trim();
          const selectedModel = getGenerationModel(node.nodeData.properties.model);
          const count = normalizeOutputCount(node.nodeData.properties.count, selectedModel.id);
          const allUrls: string[] = [];
          const currentOutputIds = runOutputIds.get(id) ?? [];
          let lastError: string | undefined;

          for (let i = 0; i < count; i++) {
            const outputId = currentOutputIds[i];
            const outputNode = outputId ? getNode(outputId) : null;
            const result = await runGeneration({
              prompt,
              model: selectedModel.id,
              outputType: selectedModel.outputType,
              imageUrl: sourceUrl?.startsWith("http") ? sourceUrl : undefined,
            });
            if (result.url) {
              allUrls.push(result.url);
              if (outputNode?.nodeData) {
                const outputUrls = [...(outputNode.nodeData.outputUrls ?? []), result.url];
                updateNodeStatus(outputNode.id, "done", result.url, undefined, outputUrls);
                outputNode.nodeData = {
                  ...outputNode.nodeData,
                  status: "done",
                  outputUrl: result.url,
                  outputUrls,
                  error: undefined,
                };
              }
              await saveGeneratedMedia({
                projectId: project.id,
                nodeId: outputNode?.id ?? id,
                outputIndex: i,
                mediaType: selectedModel.outputType,
                url: result.url,
                model: selectedModel.id,
                prompt,
                sourceUrl: sourceUrl,
              });
            } else {
              lastError = result.error || "Generation failed";
              console.error("OpenCreative workflow generation failed", {
                projectId: project.id,
                nodeId: id,
                model: selectedModel.id,
                outputType: selectedModel.outputType,
                outputIndex: i,
                error: lastError,
              });
              if (outputNode?.nodeData) {
                updateNodeStatus(
                  outputNode.id,
                  "error",
                  outputNode.nodeData.outputUrl,
                  lastError,
                  outputNode.nodeData.outputUrls
                );
                outputNode.nodeData = {
                  ...outputNode.nodeData,
                  status: "error",
                  outputUrl: outputNode.nodeData.outputUrl,
                  error: lastError,
                };
              }
              anyError = true;
            }
          }

          if (allUrls.length > 0) {
            updateNodeStatus(id, "done", allUrls[0], undefined, allUrls);
          } else {
            updateNodeStatus(id, "error", undefined, lastError || "Generation failed");
          }
        } else if (node.type === "output") {
          if (node.nodeData.status === "idle") {
            done.add(id);
            continue;
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
        addToast({ title: "Workflow finished with errors", message: "Generation errors were logged. Select failed output nodes for details.", variant: "warning" });
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
  }, [elements, connections, running, project.id, updateNodeStatus, addElements, addToast]);

  const commands = useMemo(
    () => [
      {
        id: "tool-select",
        title: "Select tool",
        section: "Tools",
        shortcut: "V",
        icon: <MousePointer2 className="size-3.5" />,
        onSelect: () => setActiveTool("select"),
      },
      {
        id: "tool-rectangle",
        title: "Rectangle tool",
        section: "Tools",
        shortcut: "R",
        icon: <Square className="size-3.5" />,
        onSelect: () => setActiveTool("rectangle"),
      },
      {
        id: "tool-ellipse",
        title: "Ellipse tool",
        section: "Tools",
        shortcut: "O",
        icon: <Circle className="size-3.5" />,
        onSelect: () => setActiveTool("ellipse"),
      },
      {
        id: "tool-triangle",
        title: "Triangle tool",
        section: "Tools",
        shortcut: "G",
        icon: <Triangle className="size-3.5" />,
        onSelect: () => setActiveTool("triangle"),
      },
      {
        id: "tool-diamond",
        title: "Diamond tool",
        section: "Tools",
        shortcut: "H",
        icon: <Diamond className="size-3.5" />,
        onSelect: () => setActiveTool("diamond"),
      },
      {
        id: "tool-star",
        title: "Star tool",
        section: "Tools",
        shortcut: "S",
        icon: <Star className="size-3.5" />,
        onSelect: () => setActiveTool("star"),
      },
      {
        id: "tool-line",
        title: "Line tool",
        section: "Tools",
        shortcut: "L",
        icon: <Minus className="size-3.5" />,
        onSelect: () => setActiveTool("line"),
      },
      {
        id: "tool-arrow",
        title: "Arrow tool",
        section: "Tools",
        shortcut: "A",
        icon: <ArrowRight className="size-3.5" />,
        onSelect: () => setActiveTool("arrow"),
      },
      {
        id: "tool-text",
        title: "Text tool",
        section: "Tools",
        shortcut: "T",
        icon: <Type className="size-3.5" />,
        onSelect: () => setActiveTool("text"),
      },
      {
        id: "tool-draw",
        title: "Draw tool",
        section: "Tools",
        shortcut: "D",
        icon: <PenLine className="size-3.5" />,
        onSelect: () => setActiveTool("draw"),
      },
      {
        id: "node-prompt",
        title: "Prompt node",
        section: "Nodes",
        icon: <FileText className="size-3.5" />,
        onSelect: () => setActiveTool("prompt"),
      },
      {
        id: "node-source",
        title: "Source node",
        section: "Nodes",
        icon: <ImageIcon className="size-3.5" />,
        onSelect: () => setActiveTool("source"),
      },
      {
        id: "node-generate",
        title: "Generate node",
        section: "Nodes",
        icon: <Sparkles className="size-3.5" />,
        onSelect: () => setActiveTool("generate"),
      },
      {
        id: "node-output",
        title: "Output node",
        section: "Nodes",
        icon: <Monitor className="size-3.5" />,
        onSelect: () => setActiveTool("output"),
      },
      {
        id: "workflow-run",
        title: "Run workflow",
        section: "Workflow",
        icon: <Play className="size-3.5" />,
        onSelect: handleRun,
      },
      {
        id: "edit-undo",
        title: "Undo",
        section: "Edit",
        shortcut: "Ctrl+Z",
        icon: <RotateCcw className="size-3.5" />,
        onSelect: () => canUndo && undo(),
      },
      {
        id: "edit-redo",
        title: "Redo",
        section: "Edit",
        shortcut: "Ctrl+Shift+Z",
        icon: <Redo className="size-3.5" />,
        onSelect: () => canRedo && redo(),
      },
      {
        id: "edit-duplicate",
        title: "Duplicate selection",
        section: "Edit",
        shortcut: "Ctrl+D",
        icon: <Copy className="size-3.5" />,
        onSelect: duplicateSelection,
      },
      {
        id: "edit-delete",
        title: "Delete selection",
        section: "Edit",
        shortcut: "Del",
        icon: <Trash2 className="size-3.5" />,
        onSelect: () => selectedIds.length > 0 && removeElements(selectedIds),
      },
      {
        id: "align-left",
        title: "Align left",
        section: "Align",
        onSelect: () => selectedIds.length >= 2 && alignSelection("left"),
      },
      {
        id: "align-center-h",
        title: "Align center horizontally",
        section: "Align",
        onSelect: () => selectedIds.length >= 2 && alignSelection("center-h"),
      },
      {
        id: "align-right",
        title: "Align right",
        section: "Align",
        onSelect: () => selectedIds.length >= 2 && alignSelection("right"),
      },
      {
        id: "align-top",
        title: "Align top",
        section: "Align",
        onSelect: () => selectedIds.length >= 2 && alignSelection("top"),
      },
      {
        id: "align-center-v",
        title: "Align center vertically",
        section: "Align",
        onSelect: () => selectedIds.length >= 2 && alignSelection("center-v"),
      },
      {
        id: "align-bottom",
        title: "Align bottom",
        section: "Align",
        onSelect: () => selectedIds.length >= 2 && alignSelection("bottom"),
      },
      {
        id: "view-reset-zoom",
        title: "Reset zoom",
        section: "View",
        icon: <ZoomIn className="size-3.5" />,
        onSelect: () => setCamera({ x: 0, y: 0, zoom: 1 }),
      },
      {
        id: "view-fit",
        title: "Fit to view",
        section: "View",
        icon: <Maximize className="size-3.5" />,
        onSelect: () => setCamera({ x: 0, y: 0, zoom: 1 }),
      },
      {
        id: "view-toggle-grid",
        title: "Toggle grid",
        section: "View",
        icon: <Grid3X3 className="size-3.5" />,
        onSelect: toggleShowGrid,
      },
      {
        id: "view-toggle-snap",
        title: "Toggle snap to grid",
        section: "View",
        icon: <Magnet className="size-3.5" />,
        onSelect: toggleSnapToGrid,
      },
    ],
    [
      setActiveTool,
      handleRun,
      canUndo,
      undo,
      canRedo,
      redo,
      duplicateSelection,
      selectedIds,
      removeElements,
      alignSelection,
      setCamera,
      toggleShowGrid,
      toggleSnapToGrid,
    ]
  );

  useRegisterCommands(commands);

  useEffect(() => {
    setRunWorkflow(handleRun);
    return () => setRunWorkflow(undefined);
  }, [handleRun, setRunWorkflow]);

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
          <button
            onClick={() => {
              const next = !autoSave;
              onToggleAutoSave(next);
              if (!next) {
                addToast({
                  title: "Auto-save disabled",
                  message: "Remember to save your work manually.",
                  variant: "info",
                });
              }
            }}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-neutral-100"
            title={
              autoSave
                ? "Auto-save is on. Click to disable."
                : "Auto-save is off. Click to enable."
            }
          >
            {autoSave ? (
              <Bell className="size-3" />
            ) : (
              <BellOff className="size-3" />
            )}
            <span>{autoSave ? "Auto" : "Manual"}</span>
          </button>

          {!autoSave && (
            <button
              onClick={onManualSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-neutral-100 disabled:opacity-50"
            >
              <Save className="size-3" />
              {saving ? "Saving…" : "Save"}
            </button>
          )}

          {saving && autoSave && (
            <span className="flex items-center gap-1.5 text-xs text-neutral-400">
              <Loader2 className="size-3 animate-spin" />
              Saving…
            </span>
          )}

          <OutputGalleryButton projectId={project.id} />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside
          className="relative overflow-y-auto border-r border-neutral-200 bg-neutral-50"
          style={{ width: leftPanel.width }}
        >
          <AIPanel projectId={project.id} projectName={project.name} />
          <ToolsPanel />
          <ResizableHandle
            onPointerDown={leftPanel.startResize(1)}
            className="right-0 top-0 h-full"
          />
        </aside>

        <main className="relative flex-1 overflow-hidden bg-neutral-100">
          <AlignToolbar />
          <Canvas />
          <ZoomControls />
          <MiniMap />
        </main>

        <aside
          className="relative overflow-y-auto border-l border-neutral-200 bg-white"
          style={{ width: rightPanel.width }}
        >
          <ResizableHandle
            onPointerDown={rightPanel.startResize(-1)}
            className="left-0 top-0 h-full"
          />
          <PropertiesPanel />
        </aside>
      </div>
    </div>
  );
}
