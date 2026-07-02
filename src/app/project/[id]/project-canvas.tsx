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
  RotateCcw,
  Redo,
  Undo,
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
import { CanvasProvider, useCanvas } from "@/lib/canvas/context";
import { saveGeneratedMedia, updateProjectWorkflow } from "@/lib/projects/client-service";
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
import { getGenerationModel } from "@/lib/canvas/generation-models";
import {
  collectGenerateInput,
  getNode,
  prepareWorkflowRun,
} from "@/lib/canvas/workflow-engine";
import { useKeyboardShortcuts } from "@/lib/canvas/use-keyboard-shortcuts";
import { useRegisterCommands } from "@/lib/command-palette/context";
import type { Project } from "@/lib/projects/service";
import type { NodeStatus, WorkflowState } from "@/types/canvas";

export function ProjectCanvasEditor({ project }: { project: Project }) {
  const [saveStatus, setSaveStatus] = useState<"saved" | "pending" | "saving" | "error">("saved");
  const [autoSave, setAutoSave] = useState(true);
  const autoSaveRef = useRef(autoSave);
  autoSaveRef.current = autoSave;
  const latestStateRef = useRef<WorkflowState | null>(null);
  const saveStateRef = useRef<"idle" | "scheduled" | "saving">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedStateRef = useRef(JSON.stringify(project.workflow));
  const pendingAfterSaveRef = useRef(false);

  const scheduleSave = useCallback(() => {
    if (saveStateRef.current === "saving") {
      pendingAfterSaveRef.current = true;
      setSaveStatus("pending");
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveStateRef.current = "scheduled";
    setSaveStatus("pending");
    saveTimerRef.current = setTimeout(async () => {
      const state = latestStateRef.current;
      if (!state || !autoSaveRef.current) {
        saveStateRef.current = "idle";
        return;
      }
      const serialized = JSON.stringify(state);
      if (serialized === lastSavedStateRef.current) {
        saveStateRef.current = "idle";
        setSaveStatus("saved");
        return;
      }
      saveStateRef.current = "saving";
      pendingAfterSaveRef.current = false;
      setSaveStatus("saving");
      const stateAtStart = latestStateRef.current;
      try {
        await updateProjectWorkflow(project.id, state);
        lastSavedStateRef.current = serialized;
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      } finally {
        saveStateRef.current = "idle";
        if (pendingAfterSaveRef.current || latestStateRef.current !== stateAtStart) {
          scheduleSave();
        }
      }
    }, 1000);
  }, [project.id]);

  const handleChange = useCallback(
    (state: WorkflowState) => {
      latestStateRef.current = state;
      const serialized = JSON.stringify(state);
      if (serialized === lastSavedStateRef.current) {
        setSaveStatus("saved");
        return;
      }
      setSaveStatus("pending");
      if (!autoSaveRef.current) return;
      scheduleSave();
    },
    [scheduleSave]
  );

  const manualSave = useCallback(async () => {
    if (!latestStateRef.current) return;
    if (saveStateRef.current === "saving") {
      setSaveStatus("saving");
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveStateRef.current = "saving";
    setSaveStatus("saving");
    const serialized = JSON.stringify(latestStateRef.current);
    try {
      await updateProjectWorkflow(project.id, latestStateRef.current);
      lastSavedStateRef.current = serialized;
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    } finally {
      saveStateRef.current = "idle";
    }
  }, [project.id]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return (
    <CanvasProvider initial={project.workflow} onChange={handleChange}>
      <ProjectCanvasInner
        project={project}
        saveStatus={saveStatus}
        autoSave={autoSave}
        onToggleAutoSave={setAutoSave}
        onManualSave={manualSave}
      />
    </CanvasProvider>
  );
}

function ProjectCanvasInner({
  project,
  saveStatus,
  autoSave,
  onToggleAutoSave,
  onManualSave,
}: {
  project: Project;
  saveStatus: "saved" | "pending" | "saving" | "error";
  autoSave: boolean;
  onToggleAutoSave: (value: boolean) => void;
  onManualSave: () => void;
}) {
  const {
    elements,
    connections,
    replaceWorkflowGraph,
    commitWorkflowGraph,
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
  const [queueCount, setQueueCount] = useState(0);
  const runningRef = useRef(false);
  const queueRef = useRef(0);
  const leftPanel = useResizablePanel("left", 224, { min: 180, max: 360 });
  const rightPanel = useResizablePanel("right", 256, { min: 200, max: 400 });

  useKeyboardShortcuts();

  const handleRunRef = useRef<() => void>(() => {});
  const processQueueRef = useRef<() => void>(() => {});
  const processQueue = useCallback(() => {
    if (queueRef.current > 0) {
      queueRef.current--;
      setQueueCount(queueRef.current);
      handleRunRef.current();
    }
  }, []);
  processQueueRef.current = processQueue;

  const handleRun = useCallback(async () => {
    if (runningRef.current) {
      queueRef.current++;
      setQueueCount(queueRef.current);
      addToast({ title: "Workflow queued", message: "Added to queue — waiting for current run to finish.", variant: "info" });
      return;
    }

    runningRef.current = true;
    setRunning(true);

    let anyError = false;
    let anySaveError = false;

    try {
      const prepared = prepareWorkflowRun(elements, connections);
      if (prepared.issues.length > 0) {
        addToast({
          title: "Workflow cannot run",
          message: prepared.issues[0],
          variant: "error",
        });
        return;
      }

      let workingElements = prepared.elements;
      const workingConnections = prepared.connections;

      const setNodeState = (
        id: string,
        patch: {
          status?: NodeStatus;
          outputUrl?: string;
          outputUrls?: string[];
          error?: string;
        }
      ) => {
        workingElements = workingElements.map((element) => {
          if (element.id !== id || !element.nodeData) return element;
          return {
            ...element,
            nodeData: {
              ...element.nodeData,
              ...patch,
              properties: { ...element.nodeData.properties },
            },
          };
        });
      };

      const appendOutputResult = (id: string, url: string) => {
        workingElements = workingElements.map((element) => {
          if (element.id !== id || !element.nodeData) return element;
          const outputUrls = [...(element.nodeData.outputUrls ?? [])];
          outputUrls.push(url);
          const selectedOutputIndex = String(outputUrls.length - 1);
          return {
            ...element,
            nodeData: {
              ...element.nodeData,
              status: "done",
              outputUrl: url,
              outputUrls,
              error: undefined,
              properties: {
                ...element.nodeData.properties,
                selectedOutputIndex,
              },
            },
          };
        });
      };

      const flushRunState = () => {
        replaceWorkflowGraph(workingElements, workingConnections);
      };

      if (prepared.addedElements.length > 0 || prepared.addedConnections.length > 0) {
        commitWorkflowGraph(workingElements, workingConnections);
      } else {
        flushRunState();
      }

      if (prepared.generateIds.length === 0) {
        addToast({
          title: "No generate nodes",
          message: "Add a generate node and connect a prompt or source to run a workflow.",
          variant: "info",
        });
        return;
      }

      for (const generateId of prepared.generateIds) {
        const generateNode = getNode(workingElements, generateId);
        if (!generateNode) continue;

        const selectedModel = getGenerationModel(generateNode.nodeData.properties.model);
        const outputIds = prepared.freshOutputIds[generateId] ?? [];
        const input = collectGenerateInput(workingElements, workingConnections, generateId);

        if (outputIds.length === 0) {
          const message = "Connect at least one output node before running this generate node.";
          setNodeState(generateId, { status: "error", error: message });
          flushRunState();
          addToast({
            title: "Generate needs an output",
            message,
            variant: "warning",
          });
          anyError = true;
          continue;
        }

        if (!input.prompt && !input.mediaUrl) {
          const message = "Connect at least one prompt or source before running this generate node.";
          setNodeState(generateId, { status: "error", error: message });
          outputIds.forEach((id) => setNodeState(id, { status: "error", error: message }));
          flushRunState();
          addToast({
            title: "Generate needs an input",
            message,
            variant: "warning",
          });
          anyError = true;
          continue;
        }

        setNodeState(generateId, { status: "running", error: undefined });
        outputIds.forEach((id) => setNodeState(id, { status: "running", error: undefined }));
        flushRunState();

        if (input.mediaUrl && !selectedModel.supportsImageInput) {
          const message = `The selected model (${selectedModel.label}) does not support image input. Connect a prompt-only workflow or switch to a model that accepts images.`;
          setNodeState(generateId, { status: "error", error: message });
          outputIds.forEach((id) => setNodeState(id, { status: "error", error: message }));
          flushRunState();
          anyError = true;
          continue;
        }

        const results = await Promise.all(
          outputIds.map(async (_outputId, index) => {
            const result = await runGeneration({
              prompt: input.prompt,
              model: selectedModel.id,
              outputType: selectedModel.outputType,
              imageUrl: input.mediaUrl,
              duration: generateNode.nodeData.properties.duration,
            });
            return { index, result };
          })
        );

        const allUrls: string[] = [];
        let lastError: string | undefined;

        for (const { index, result } of results) {
          const outputId = outputIds[index];
          if (result.url) {
            allUrls[index] = result.url;
            if (outputId) {
              appendOutputResult(outputId, result.url);
            }
          } else {
            lastError = result.error || "Generation failed";
            anyError = true;
            if (outputId) {
              setNodeState(outputId, {
                status: "error",
                error: lastError,
              });
            }
          }
        }

        const successfulResults = allUrls
          .map((url, index) => (url ? { url, index } : null))
          .filter((item): item is { url: string; index: number } => Boolean(item));
        const successfulUrls = successfulResults.map((item) => item.url);
        if (successfulResults.length > 0) {
          setNodeState(generateId, {
            status: "done",
            outputUrl: successfulUrls[0],
            outputUrls: successfulUrls,
            error: undefined,
          });
          const saveResults = await Promise.allSettled(
            successfulResults.map(({ url, index }) =>
              saveGeneratedMedia({
                projectId: project.id,
                nodeId: outputIds[index] ?? generateId,
                outputIndex: index,
                mediaType: selectedModel.outputType,
                url,
                model: selectedModel.id,
                prompt: input.prompt,
                sourceUrl: input.sourceUrl,
              })
            )
          );
          anySaveError = saveResults.some((result) => result.status === "rejected");
        } else {
          setNodeState(generateId, {
            status: "error",
            error: lastError || "Generation failed",
          });
        }
        flushRunState();
      }

      if (anyError && anySaveError) {
        addToast({ title: "Workflow finished with errors", message: "Some generations or media saves failed.", variant: "warning", action: { label: "Retry", onClick: handleRun } });
      } else if (anyError) {
        addToast({ title: "Workflow finished with errors", message: "Generation failed. Select failed nodes for details.", variant: "warning", action: { label: "Retry", onClick: handleRun } });
      } else if (anySaveError) {
        addToast({ title: "Workflow complete", message: "Outputs were created, but some gallery saves failed.", variant: "warning" });
      } else {
        addToast({ title: "Workflow complete", message: "All nodes finished successfully.", variant: "success" });
      }
    } catch (err) {
      addToast({
        title: "Workflow failed",
        message: err instanceof Error ? err.message : "An unexpected error occurred.",
        variant: "error",
      });
    } finally {
      runningRef.current = false;
      setRunning(false);
      processQueueRef.current();
    }
  }, [elements, connections, project.id, replaceWorkflowGraph, commitWorkflowGraph, addToast]);

  handleRunRef.current = handleRun;

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
          <div className="flex items-center gap-0.5 rounded-md border border-neutral-200 bg-white p-0.5">
            <button
              onClick={undo}
              disabled={!canUndo}
              className="flex size-7 items-center justify-center rounded text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 disabled:text-neutral-300 disabled:hover:bg-transparent"
              title="Undo"
              aria-label="Undo"
            >
              <Undo className="size-3.5" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className="flex size-7 items-center justify-center rounded text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 disabled:text-neutral-300 disabled:hover:bg-transparent"
              title="Redo"
              aria-label="Redo"
            >
              <Redo className="size-3.5" />
            </button>
          </div>
          <button
            onClick={() => {
              const next = !autoSave;
              onToggleAutoSave(next);
            }}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${
              autoSave ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
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
            <>
              <button
                onClick={onManualSave}
                disabled={saveStatus === "saving" || saveStatus === "saved"}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-neutral-100 disabled:opacity-50"
              >
                {saveStatus === "saving" ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                {saveStatus === "saving" ? "Saving..." : saveStatus === "error" ? "Retry save" : "Save"}
              </button>
              <span
                className={`text-xs ${
                  saveStatus === "error"
                    ? "text-red-600"
                    : saveStatus === "pending"
                      ? "text-neutral-500"
                      : "text-neutral-400"
                }`}
              >
                {saveStatus === "pending" && "Unsaved changes"}
                {saveStatus === "saved" && "Saved"}
                {saveStatus === "error" && "Save failed"}
              </span>
            </>
          )}

          {autoSave && (
            <span
              className={`flex items-center gap-1.5 text-xs ${
                saveStatus === "error"
                  ? "text-red-600"
                  : saveStatus === "saved"
                    ? "text-neutral-400"
                    : "text-neutral-500"
              }`}
            >
              {saveStatus === "saving" && <Loader2 className="size-3 animate-spin" />}
              {saveStatus === "pending" && "Unsaved changes"}
              {saveStatus === "saving" && "Saving..."}
              {saveStatus === "saved" && "Saved"}
              {saveStatus === "error" && "Save failed"}
            </span>
          )}

          {queueCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-amber-600">
              <Loader2 className="size-3 animate-spin" />
              {queueCount} queued
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
