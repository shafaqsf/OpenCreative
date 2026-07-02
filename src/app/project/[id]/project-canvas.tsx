"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ResizableHandle,
  useResizablePanel,
} from "@/components/ui/resizable-handle";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Loader2,
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
  Search,
  MoreHorizontal,
  Settings,
  X,
  PanelRightOpen,
  Crosshair,
  Play,
  ListFilter,
  Pencil,
  CopyPlus,
} from "lucide-react";
import { CanvasProvider, useCanvas } from "@/lib/canvas/context";
import {
  deleteProject,
  duplicateProject,
  saveGeneratedMedia,
  updateProjectName,
  updateProjectWorkflow,
} from "@/lib/projects/client-service";
import { useToast } from "@/lib/toast/context";
import { Canvas } from "@/components/canvas/canvas";
import { ZoomControls } from "@/components/canvas/zoom-controls";
import { AlignToolbar } from "@/components/canvas/align-toolbar";
import { MiniMap } from "@/components/canvas/mini-map";
import { OutputGalleryButton } from "@/components/canvas/output-gallery";
import { PropertiesPanel } from "@/components/canvas/properties-panel";
import { AIPanel } from "@/components/dashboard/panels/ai-panel";
import { ToolsPanel } from "@/components/dashboard/panels/tools-panel";
import { formatGenerationFailureForUser } from "@/lib/canvas/generation-errors";
import { runGeneration } from "@/lib/canvas/run-workflow";
import { getGenerationModel } from "@/lib/canvas/generation-models";
import { appendOutputVersion } from "@/lib/canvas/output-versions";
import {
  collectGenerateInput,
  getGenerateRunIssue,
  getNode,
  prepareWorkflowRun,
} from "@/lib/canvas/workflow-engine";
import { sanitizeWorkflowForPersistence } from "@/lib/canvas/workflow-persistence";
import { useKeyboardShortcuts } from "@/lib/canvas/use-keyboard-shortcuts";
import { useRegisterCommands } from "@/lib/command-palette/context";
import type { Project } from "@/lib/projects/service";
import type { CanvasElement, NodeStatus, NodeType, WorkflowState } from "@/types/canvas";

export function ProjectCanvasEditor({ project }: { project: Project }) {
  const initialWorkflow = useMemo(
    () => sanitizeWorkflowForPersistence(project.workflow),
    [project.workflow]
  );
  const [saveStatus, setSaveStatus] = useState<"saved" | "pending" | "saving" | "error">("saved");
  const [autoSave, setAutoSave] = useState(true);
  const autoSaveRef = useRef(autoSave);
  autoSaveRef.current = autoSave;
  const latestStateRef = useRef<WorkflowState | null>(null);
  const saveStateRef = useRef<"idle" | "scheduled" | "saving">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedStateRef = useRef(JSON.stringify(initialWorkflow));
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
      const persistedState = sanitizeWorkflowForPersistence(state);
      const serialized = JSON.stringify(persistedState);
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
        await updateProjectWorkflow(project.id, persistedState);
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
      const serialized = JSON.stringify(sanitizeWorkflowForPersistence(state));
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
    const persistedState = sanitizeWorkflowForPersistence(latestStateRef.current);
    const serialized = JSON.stringify(persistedState);
    try {
      await updateProjectWorkflow(project.id, persistedState);
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
    <CanvasProvider initial={initialWorkflow} onChange={handleChange}>
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

function CanvasSearchModal({
  query,
  filter,
  results,
  selectedCount,
  onQueryChange,
  onFilterChange,
  onClose,
  onFocus,
  onSelectVisible,
  onDeleteVisible,
}: {
  query: string;
  filter: CanvasNodeFilter;
  results: CanvasElement[];
  selectedCount: number;
  onQueryChange: (query: string) => void;
  onFilterChange: (filter: CanvasNodeFilter) => void;
  onClose: () => void;
  onFocus: (element: CanvasElement) => void;
  onSelectVisible: () => void;
  onDeleteVisible: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/25 px-4 pt-24" onClick={onClose}>
      <div className="glass-panel-strong w-full max-w-2xl overflow-hidden rounded-2xl shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-white/70 bg-white/75 px-4 py-3">
          <Search className="size-4 text-neutral-400" />
          <input
            autoFocus
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search nodes, campaign details, outputs, statuses..."
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-neutral-900 outline-none placeholder:text-neutral-400"
          />
          <button type="button" onClick={onClose} className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900">
            <X className="size-4" />
          </button>
        </div>
        <CanvasFilterTabs value={filter} onChange={onFilterChange} />
        <div className="max-h-[52vh] overflow-y-auto bg-white">
          {results.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-neutral-400">No canvas items found.</p>
          ) : (
            results.map((element) => (
              <button
                key={element.id}
                type="button"
                onClick={() => onFocus(element)}
                className="flex w-full items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 text-left hover:bg-neutral-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-neutral-900">{getElementLabel(element)}</span>
                  <span className="mt-0.5 block truncate text-xs text-neutral-500">
                    {element.nodeData?.nodeType ?? element.type} · {element.nodeData?.status ?? "canvas item"}
                  </span>
                </span>
                <span className="rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] font-medium capitalize text-neutral-500">
                  {getElementCategory(element)}
                </span>
              </button>
            ))
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 bg-neutral-50 px-4 py-3">
          <span className="text-xs text-neutral-500">
            {results.length} visible · {selectedCount} selected in results
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onSelectVisible} disabled={results.length === 0} className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
              Select visible
            </button>
            <button type="button" onClick={onDeleteVisible} disabled={results.length === 0} className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
              Delete visible
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CanvasNavigatorDrawer({
  query,
  filter,
  elements,
  selectedIds,
  onQueryChange,
  onFilterChange,
  onClose,
  onFocus,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
  onSelectVisible,
}: {
  query: string;
  filter: CanvasNodeFilter;
  elements: CanvasElement[];
  selectedIds: string[];
  onQueryChange: (query: string) => void;
  onFilterChange: (filter: CanvasNodeFilter) => void;
  onClose: () => void;
  onFocus: (element: CanvasElement) => void;
  onSelect: (id: string) => void;
  onRename: (id: string, label: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onSelectVisible: () => void;
}) {
  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-white/70 bg-white/95 shadow-2xl backdrop-blur">
      <div className="glass-panel-strong rounded-none border-x-0 border-t-0 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Navigator</h2>
            <p className="text-xs text-neutral-500">Find, select, rename, duplicate, or delete canvas items.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900">
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2">
          <Search className="size-3.5 text-neutral-400" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Filter navigator..."
            className="min-w-0 flex-1 text-xs outline-none placeholder:text-neutral-400"
          />
        </div>
      </div>
      <CanvasFilterTabs value={filter} onChange={onFilterChange} compact />
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2">
        <span className="text-xs text-neutral-500">{elements.length} visible</span>
        <button type="button" onClick={onSelectVisible} disabled={elements.length === 0} className="rounded-md border border-neutral-200 px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
          Select visible
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {elements.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-neutral-400">No items match this view.</p>
        ) : (
          elements.map((element) => {
            const selected = selectedIds.includes(element.id);
            return (
              <div key={element.id} className={`border-b border-neutral-100 px-4 py-3 ${selected ? "bg-emerald-50/70" : "bg-white"}`}>
                <div className="flex items-start justify-between gap-2">
                  <button type="button" onClick={() => onFocus(element)} className="min-w-0 text-left">
                    <span className="block truncate text-sm font-semibold text-neutral-900">{getElementLabel(element)}</span>
                    <span className="mt-0.5 block truncate text-xs text-neutral-500">
                      {element.nodeData?.nodeType ?? element.type} · {element.nodeData?.status ?? "canvas item"}
                    </span>
                  </button>
                  <span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-medium capitalize text-neutral-500">
                    {getElementCategory(element)}
                  </span>
                </div>
                <input
                  value={element.customLabel ?? ""}
                  onChange={(event) => onRename(element.id, event.target.value)}
                  placeholder={element.nodeData?.label ?? element.type}
                  className="mt-2 w-full rounded-md border border-neutral-200 px-2 py-1.5 text-xs outline-none focus:border-neutral-400"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => onSelect(element.id)} className="rounded border border-neutral-200 px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50">
                    Select
                  </button>
                  <button type="button" onClick={() => onFocus(element)} className="rounded border border-neutral-200 px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50">
                    Focus
                  </button>
                  <button type="button" onClick={() => onDuplicate(element.id)} className="rounded border border-neutral-200 px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50">
                    Duplicate
                  </button>
                  <button type="button" onClick={() => onDelete(element.id)} className="rounded border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50">
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function CanvasFilterTabs({
  value,
  onChange,
  compact = false,
}: {
  value: CanvasNodeFilter;
  onChange: (filter: CanvasNodeFilter) => void;
  compact?: boolean;
}) {
  const filters: { value: CanvasNodeFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "marketing", label: "Marketing" },
    { value: "technical", label: "Technical" },
    { value: "outputs", label: "Outputs" },
    { value: "review", label: "Review" },
  ];
  return (
    <div className={`flex flex-wrap gap-1 border-b border-neutral-100 bg-neutral-50 ${compact ? "px-4 py-2" : "px-4 py-3"}`}>
      {filters.map((filter) => (
        <button
          key={filter.value}
          type="button"
          onClick={() => onChange(filter.value)}
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
            value === filter.value
              ? "bg-neutral-900 text-white"
              : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

function RenameCampaignDialog({
  value,
  pending,
  onChange,
  onClose,
  onSubmit,
}: {
  value: string;
  pending: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 px-4" onClick={onClose}>
      <div className="glass-panel-strong w-full max-w-md overflow-hidden rounded-2xl shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/70 bg-white/75 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Rename campaign</h2>
            <p className="text-xs text-neutral-500">Use a client-facing campaign name marketers can recognize quickly.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900">
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-3 bg-white px-4 py-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-500">Campaign name</span>
            <input
              autoFocus
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onSubmit();
                if (event.key === "Escape") onClose();
              }}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
              Cancel
            </button>
            <button type="button" onClick={onSubmit} disabled={pending || !value.trim()} className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-50">
              {pending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
              Save name
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CampaignSettingsDialog({
  project,
  projectName,
  elementCount,
  connectionCount,
  selectedCount,
  saveStatus,
  autoSave,
  onClose,
  onRename,
}: {
  project: Project;
  projectName: string;
  elementCount: number;
  connectionCount: number;
  selectedCount: number;
  saveStatus: string;
  autoSave: boolean;
  onClose: () => void;
  onRename: () => void;
}) {
  const rows = [
    ["Campaign", projectName],
    ["Project ID", project.id],
    ["Canvas items", String(elementCount)],
    ["Connections", String(connectionCount)],
    ["Selected", String(selectedCount)],
    ["Save mode", autoSave ? "Auto-save" : "Manual save"],
    ["Save status", saveStatus],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 px-4" onClick={onClose}>
      <div className="glass-panel-strong w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/70 bg-white/75 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Campaign settings</h2>
            <p className="text-xs text-neutral-500">A quick operational snapshot for the current workspace.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900">
            <X className="size-4" />
          </button>
        </div>
        <div className="bg-white px-4 py-4">
          <div className="overflow-hidden rounded-xl border border-neutral-200">
            {rows.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[120px_1fr] gap-3 border-b border-neutral-100 px-3 py-2 last:border-b-0">
                <span className="text-xs font-medium text-neutral-500">{label}</span>
                <span className="truncate text-xs text-neutral-900">{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onRename} className="rounded-md border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
              Rename campaign
            </button>
            <button type="button" onClick={onClose} className="rounded-md bg-neutral-900 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-800">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmDangerDialog({
  action,
  projectName,
  elementCount,
  confirmText,
  pending,
  onConfirmTextChange,
  onClose,
  onConfirm,
}: {
  action: Exclude<ConfirmAction, null>;
  projectName: string;
  elementCount: number;
  confirmText: string;
  pending: boolean;
  onConfirmTextChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const deletingCampaign = action === "delete-campaign";
  const canConfirm = deletingCampaign ? confirmText.trim() === projectName : confirmText.trim().toLowerCase() === "clear";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-red-100 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-red-100 bg-red-50 px-4 py-3">
          <h2 className="text-sm font-semibold text-red-900">
            {deletingCampaign ? "Delete campaign?" : "Clear canvas?"}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-red-700">
            {deletingCampaign
              ? "This removes the campaign from the project list. This cannot be undone from the canvas."
              : `This removes ${elementCount} canvas items and all connections. You can use Undo before leaving or reloading.`}
          </p>
        </div>
        <div className="space-y-3 px-4 py-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">
              Type {deletingCampaign ? `"${projectName}"` : '"clear"'} to confirm
            </span>
            <input
              autoFocus
              value={confirmText}
              onChange={(event) => onConfirmTextChange(event.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-red-400"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
              Cancel
            </button>
            <button type="button" onClick={onConfirm} disabled={!canConfirm || pending} className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">
              {pending ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
              {deletingCampaign ? "Delete campaign" : "Clear canvas"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type CanvasNodeFilter = "all" | "marketing" | "technical" | "outputs" | "review";
type ConfirmAction = "clear-canvas" | "delete-campaign" | null;

const TECHNICAL_NODE_TYPES = new Set<NodeType>(["prompt", "source", "generate", "output"]);

function getElementLabel(element: CanvasElement) {
  if (element.customLabel?.trim()) return element.customLabel.trim();
  if (element.nodeData?.label) return element.nodeData.label;
  if (element.text?.trim()) return element.text.trim();
  return element.type.charAt(0).toUpperCase() + element.type.slice(1);
}

function getElementCategory(element: CanvasElement): Exclude<CanvasNodeFilter, "all"> {
  if (element.nodeData?.nodeType === "output" || element.nodeData?.nodeType === "generate") return "outputs";
  if (element.nodeData?.nodeType === "review") return "review";
  if (element.nodeData && TECHNICAL_NODE_TYPES.has(element.nodeData.nodeType)) return "technical";
  if (element.nodeData) return "marketing";
  return "technical";
}

function getElementSearchText(element: CanvasElement) {
  return [
    getElementLabel(element),
    element.type,
    element.nodeData?.nodeType,
    element.nodeData?.status,
    element.nodeData?.error,
    element.nodeData?.outputUrl,
    ...(element.nodeData?.outputUrls ?? []),
    ...(element.nodeData?.outputVersions ?? []).flatMap((version) => [
      version.url,
      version.operationType,
      version.approvalState,
      version.promptDelta,
      version.editMetadata?.label,
    ]),
    ...Object.values(element.nodeData?.properties ?? {}),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getElementCenter(element: CanvasElement) {
  if (element.points?.length) {
    const x = element.points.reduce((sum, point) => sum + point.x, 0) / element.points.length;
    const y = element.points.reduce((sum, point) => sum + point.y, 0) / element.points.length;
    return { x, y };
  }
  return {
    x: element.x + element.width / 2,
    y: element.y + element.height / 2,
  };
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
  const router = useRouter();
  const {
    elements,
    connections,
    replaceWorkflowGraph,
    commitWorkflowGraph,
    removeElements,
    selectElements,
    selectedIds,
    setActiveTool,
    setCamera,
    undo,
    redo,
    canUndo,
    canRedo,
    duplicateElements,
    duplicateSelection,
    renameElement,
    selectAll,
    toggleSnapToGrid,
    toggleShowGrid,
    alignSelection,
    distributeSelection,
    setRunWorkflow,
  } = useCanvas();
  const { addToast } = useToast();
  const [projectName, setProjectName] = useState(project.name);
  const [running, setRunning] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [renameOpen, setRenameOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [draftProjectName, setDraftProjectName] = useState(project.name);
  const [confirmText, setConfirmText] = useState("");
  const [nodeSearch, setNodeSearch] = useState("");
  const [nodeFilter, setNodeFilter] = useState<CanvasNodeFilter>("all");
  const [galleryOpenSignal, setGalleryOpenSignal] = useState(0);
  const [projectActionPending, setProjectActionPending] = useState(false);
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

    let anyValidationIssue = false;
    let anyGenerationError = false;
    let anySaveError = false;
    let firstValidationIssue: string | undefined;
    let firstGenerationError: string | undefined;

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
          outputVersions?: NonNullable<WorkflowState["elements"][number]["nodeData"]>["outputVersions"];
          activeOutputVersionId?: string;
          finalOutputVersionId?: string;
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

      const settleNode = (id: string) => {
        workingElements = workingElements.map((element) => {
          if (element.id !== id || !element.nodeData) return element;
          const hasMedia = Boolean(element.nodeData.outputUrl || element.nodeData.outputUrls?.length);
          const hasSource = Boolean(element.nodeData.properties.url?.trim());
          return {
            ...element,
            nodeData: {
              ...element.nodeData,
              status: hasMedia || hasSource ? "done" : "idle",
              error: undefined,
              properties: { ...element.nodeData.properties },
            },
          };
        });
      };

      const appendOutputResult = (id: string, url: string) => {
        workingElements = workingElements.map((element) => {
          if (element.id !== id || !element.nodeData) return element;
          const nodeData = appendOutputVersion(element.nodeData, {
            url,
            mediaType: (element.nodeData.properties.outputType as "image" | "video") || "image",
            sourceNodeId: id,
            operationType: "generated",
          });
          return {
            ...element,
            nodeData: { ...nodeData, error: undefined },
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
          message: "Add a generate node with connected input and output nodes before running.",
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
        const runIssue = getGenerateRunIssue(workingElements, workingConnections, generateId);

        if (runIssue) {
          const title = runIssue === "Connect an Output node." ? "Connect an Output node" : "Generate needs input";
          settleNode(generateId);
          outputIds.forEach(settleNode);
          flushRunState();
          addToast({
            title,
            message: runIssue,
            variant: "warning",
          });
          anyValidationIssue = true;
          firstValidationIssue ??= runIssue;
          continue;
        }

        if (input.mediaUrl && !selectedModel.supportsImageInput) {
          const message = `The selected model (${selectedModel.label}) does not support image input. Connect a prompt-only workflow or switch to a model that accepts images.`;
          settleNode(generateId);
          outputIds.forEach(settleNode);
          flushRunState();
          addToast({
            title: "Model cannot use this input",
            message,
            variant: "warning",
          });
          anyValidationIssue = true;
          firstValidationIssue ??= message;
          continue;
        }

        setNodeState(generateId, { status: "running", error: undefined });
        outputIds.forEach((id) => setNodeState(id, { status: "running", error: undefined }));
        flushRunState();

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
            lastError = formatGenerationFailureForUser(result.error || "Generation failed");
            anyGenerationError = true;
            firstGenerationError ??= lastError;
            if (outputId) {
              settleNode(outputId);
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
            status: "idle",
            outputUrl: undefined,
            outputUrls: undefined,
            error: undefined,
          });
        }
        flushRunState();
      }

      if (anyGenerationError && anySaveError) {
        addToast({ title: "Workflow finished with errors", message: firstGenerationError ?? "Some generations or media saves failed.", variant: "warning", action: { label: "Retry", onClick: handleRun } });
      } else if (anyGenerationError) {
        addToast({ title: "Generation request failed", message: firstGenerationError ?? "Select failed nodes for details.", variant: "warning", action: { label: "Retry", onClick: handleRun } });
      } else if (anySaveError) {
        addToast({ title: "Workflow complete", message: "Outputs were created, but some gallery saves failed.", variant: "warning" });
      } else if (anyValidationIssue) {
        addToast({
          title: "Workflow needs attention",
          message: firstValidationIssue ?? "Some generate nodes were skipped.",
          variant: "warning",
        });
      } else {
        addToast({ title: "Workflow complete", message: "All nodes finished successfully.", variant: "success" });
      }
    } catch (err) {
      addToast({
        title: "Workflow failed",
        message: formatGenerationFailureForUser(err),
        variant: "error",
      });
    } finally {
      runningRef.current = false;
      setRunning(false);
      processQueueRef.current();
    }
  }, [elements, connections, project.id, replaceWorkflowGraph, commitWorkflowGraph, addToast]);

  handleRunRef.current = handleRun;

  useEffect(() => {
    setProjectName(project.name);
    setDraftProjectName(project.name);
  }, [project.name]);

  const filteredElements = useMemo(() => {
    const query = nodeSearch.trim().toLowerCase();
    return elements.filter((element) => {
      if (nodeFilter !== "all" && getElementCategory(element) !== nodeFilter) return false;
      if (!query) return true;
      return getElementSearchText(element).includes(query);
    });
  }, [elements, nodeFilter, nodeSearch]);

  const selectedCount = selectedIds.length;
  const visibleSelectedCount = filteredElements.filter((element) =>
    selectedIds.includes(element.id)
  ).length;

  const focusElement = useCallback(
    (element: CanvasElement) => {
      const center = getElementCenter(element);
      setCamera({ x: center.x, y: center.y, zoom: 1 });
      selectElements([element.id]);
    },
    [selectElements, setCamera]
  );

  const focusSelected = useCallback(() => {
    const firstSelected = elements.find((element) => selectedIds.includes(element.id));
    if (firstSelected) focusElement(firstSelected);
  }, [elements, focusElement, selectedIds]);

  const selectByFilter = useCallback(
    (filter: CanvasNodeFilter) => {
      const nextIds = elements
        .filter((element) => filter === "all" || getElementCategory(element) === filter)
        .map((element) => element.id);
      selectElements(nextIds);
      addToast({
        title: "Selection updated",
        message: `${nextIds.length} ${filter === "all" ? "canvas items" : filter} items selected.`,
        variant: "info",
      });
    },
    [addToast, elements, selectElements]
  );

  const clearCanvas = useCallback(() => {
    commitWorkflowGraph([], []);
    selectElements([]);
    addToast({
      title: "Canvas cleared",
      message: "All nodes and connections were removed. Use Undo if this was accidental.",
      variant: "warning",
    });
  }, [addToast, commitWorkflowGraph, selectElements]);

  const submitRenameProject = useCallback(async () => {
    const name = draftProjectName.trim();
    if (!name || name === projectName) {
      setRenameOpen(false);
      setDraftProjectName(projectName);
      return;
    }
    setProjectActionPending(true);
    try {
      const updated = await updateProjectName(project.id, name);
      setProjectName(updated.name);
      setDraftProjectName(updated.name);
      setRenameOpen(false);
      addToast({ title: "Campaign renamed", message: updated.name, variant: "success" });
    } catch (err) {
      addToast({
        title: "Rename failed",
        message: err instanceof Error ? err.message : "Could not rename this campaign.",
        variant: "error",
      });
    } finally {
      setProjectActionPending(false);
    }
  }, [addToast, draftProjectName, project.id, projectName]);

  const submitDuplicateProject = useCallback(async () => {
    setProjectActionPending(true);
    try {
      const duplicated = await duplicateProject(project.id);
      addToast({
        title: "Campaign duplicated",
        message: `${duplicated.name} is ready to edit.`,
        variant: "success",
      });
      router.push(`/project/${duplicated.id}`);
    } catch (err) {
      addToast({
        title: "Duplicate failed",
        message: err instanceof Error ? err.message : "Could not duplicate this campaign.",
        variant: "error",
      });
    } finally {
      setProjectActionPending(false);
    }
  }, [addToast, project.id, router]);

  const submitDeleteProject = useCallback(async () => {
    if (confirmText.trim() !== projectName) return;
    setProjectActionPending(true);
    try {
      await deleteProject(project.id);
      addToast({
        title: "Campaign deleted",
        message: `${projectName} was removed.`,
        variant: "success",
      });
      router.push("/");
    } catch (err) {
      addToast({
        title: "Delete failed",
        message: err instanceof Error ? err.message : "Could not delete this campaign.",
        variant: "error",
      });
    } finally {
      setProjectActionPending(false);
    }
  }, [addToast, confirmText, project.id, projectName, router]);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    setNavigatorOpen(false);
  }, []);

  const openNavigator = useCallback(() => {
    setNavigatorOpen(true);
    setSearchOpen(false);
  }, []);

  const commands = useMemo(
    () => [
      {
        id: "campaign-rename",
        title: "Rename campaign",
        section: "Campaign",
        icon: <Pencil className="size-3.5" />,
        onSelect: () => {
          setDraftProjectName(projectName);
          setRenameOpen(true);
        },
      },
      {
        id: "campaign-settings",
        title: "Campaign settings",
        section: "Campaign",
        icon: <Settings className="size-3.5" />,
        onSelect: () => setSettingsOpen(true),
      },
      {
        id: "campaign-duplicate",
        title: "Duplicate campaign",
        section: "Campaign",
        icon: <CopyPlus className="size-3.5" />,
        onSelect: submitDuplicateProject,
      },
      {
        id: "campaign-delete",
        title: "Delete campaign",
        section: "Campaign",
        icon: <Trash2 className="size-3.5" />,
        onSelect: () => {
          setConfirmText("");
          setConfirmAction("delete-campaign");
        },
      },
      {
        id: "campaign-run",
        title: running ? "Queue workflow run" : "Run workflow",
        section: "Campaign",
        icon: <Play className="size-3.5" />,
        onSelect: handleRun,
      },
      {
        id: "campaign-gallery",
        title: "Open gallery",
        section: "Campaign",
        icon: <ImageIcon className="size-3.5" />,
        onSelect: () => setGalleryOpenSignal((value) => value + 1),
      },
      {
        id: "canvas-search",
        title: "Search canvas",
        section: "Canvas",
        shortcut: "Ctrl+F",
        icon: <Search className="size-3.5" />,
        onSelect: openSearch,
      },
      {
        id: "canvas-navigator",
        title: "Open navigator",
        section: "Canvas",
        icon: <PanelRightOpen className="size-3.5" />,
        onSelect: openNavigator,
      },
      {
        id: "canvas-select-all",
        title: "Select all canvas items",
        section: "Canvas",
        shortcut: "Ctrl+A",
        icon: <MousePointer2 className="size-3.5" />,
        onSelect: selectAll,
      },
      {
        id: "canvas-select-marketing",
        title: "Select marketing nodes",
        section: "Canvas",
        icon: <ListFilter className="size-3.5" />,
        onSelect: () => selectByFilter("marketing"),
      },
      {
        id: "canvas-select-outputs",
        title: "Select output nodes",
        section: "Canvas",
        icon: <ListFilter className="size-3.5" />,
        onSelect: () => selectByFilter("outputs"),
      },
      {
        id: "canvas-focus-selection",
        title: "Focus selected item",
        section: "Canvas",
        icon: <Crosshair className="size-3.5" />,
        onSelect: focusSelected,
      },
      {
        id: "canvas-clear",
        title: "Clear canvas",
        section: "Canvas",
        icon: <Trash2 className="size-3.5" />,
        onSelect: () => {
          setConfirmText("");
          setConfirmAction("clear-canvas");
        },
      },
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
        icon: <ImageIcon className="size-3.5" />,
        onSelect: () => setActiveTool("output"),
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
      canUndo,
      undo,
      canRedo,
      redo,
      duplicateSelection,
      focusSelected,
      handleRun,
      openNavigator,
      openSearch,
      projectName,
      selectAll,
      selectByFilter,
      selectedIds,
      removeElements,
      alignSelection,
      setCamera,
      toggleShowGrid,
      toggleSnapToGrid,
      running,
      submitDuplicateProject,
    ]
  );

  useRegisterCommands(commands);

  useEffect(() => {
    setRunWorkflow(handleRun);
    return () => setRunWorkflow(undefined);
  }, [handleRun, setRunWorkflow]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        openSearch();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openSearch]);

  return (
    <div className="flex h-dvh w-dvw flex-col overflow-hidden bg-[var(--oc-surface)] text-neutral-900">
      <header className="glass-panel-strong z-20 flex flex-wrap items-center justify-between gap-3 border-x-0 border-t-0 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="flex size-8 items-center justify-center rounded-md hover:bg-neutral-100"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-sm font-semibold">{projectName}</h1>
              <button
                type="button"
                onClick={() => {
                  setDraftProjectName(projectName);
                  setRenameOpen(true);
                }}
                className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
                title="Rename campaign"
                aria-label="Rename campaign"
              >
                <Pencil className="size-3.5" />
              </button>
            </div>
            <p className="text-xs text-neutral-500">Build your campaign</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="hidden items-center gap-1 rounded-full border border-white/70 bg-white/70 p-1 shadow-sm backdrop-blur md:flex">
            <button
              type="button"
              onClick={openSearch}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-white"
              title="Search canvas"
            >
              <Search className="size-3.5" />
              Search
            </button>
            <button
              type="button"
              onClick={openNavigator}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-white"
              title="Open navigator"
            >
              <PanelRightOpen className="size-3.5" />
              Navigator
            </button>
          </div>
          <button
            type="button"
            onClick={handleRun}
            disabled={running && queueCount > 4}
            className="flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-neutral-800 disabled:opacity-50"
          >
            {running ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
            {running ? "Queue run" : "Run"}
          </button>
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

          <OutputGalleryButton projectId={project.id} openSignal={galleryOpenSignal} />
          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((value) => !value)}
              className="flex size-8 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
              title="More campaign actions"
              aria-label="More campaign actions"
            >
              <MoreHorizontal className="size-4" />
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-white/70 bg-white/95 py-1 shadow-xl backdrop-blur">
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    setDraftProjectName(projectName);
                    setRenameOpen(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                >
                  <Pencil className="size-3.5 text-neutral-400" />
                  Rename campaign
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    setSettingsOpen(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                >
                  <Settings className="size-3.5 text-neutral-400" />
                  Campaign settings
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    submitDuplicateProject();
                  }}
                  disabled={projectActionPending}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                >
                  <CopyPlus className="size-3.5 text-neutral-400" />
                  Duplicate campaign
                </button>
                <div className="my-1 border-t border-neutral-100" />
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    openSearch();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-neutral-700 hover:bg-neutral-100 md:hidden"
                >
                  <Search className="size-3.5 text-neutral-400" />
                  Search canvas
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    openNavigator();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-neutral-700 hover:bg-neutral-100 md:hidden"
                >
                  <PanelRightOpen className="size-3.5 text-neutral-400" />
                  Navigator
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    selectAll();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                >
                  <MousePointer2 className="size-3.5 text-neutral-400" />
                  Select all nodes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    selectByFilter("marketing");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                >
                  <ListFilter className="size-3.5 text-neutral-400" />
                  Select marketing nodes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    removeElements(selectedIds);
                  }}
                  disabled={selectedCount === 0}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:text-neutral-300"
                >
                  <Trash2 className="size-3.5 text-neutral-400" />
                  Delete selected {selectedCount > 0 ? `(${selectedCount})` : ""}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    setConfirmText("");
                    setConfirmAction("clear-canvas");
                  }}
                  disabled={elements.length === 0}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 disabled:text-neutral-300"
                >
                  <Trash2 className="size-3.5" />
                  Clear canvas
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    setConfirmText("");
                    setConfirmAction("delete-campaign");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="size-3.5" />
                  Delete campaign
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside
          className="glass-panel relative z-10 overflow-y-auto border-y-0 border-l-0 bg-white/60"
          style={{ width: leftPanel.width }}
        >
          <AIPanel projectId={project.id} projectName={projectName} />
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
          className="glass-panel relative z-10 overflow-y-auto border-y-0 border-r-0 bg-white/70"
          style={{ width: rightPanel.width }}
        >
          <ResizableHandle
            onPointerDown={rightPanel.startResize(-1)}
            className="left-0 top-0 h-full"
          />
          <PropertiesPanel />
        </aside>
      </div>

      {searchOpen && (
        <CanvasSearchModal
          query={nodeSearch}
          filter={nodeFilter}
          results={filteredElements}
          selectedCount={visibleSelectedCount}
          onQueryChange={setNodeSearch}
          onFilterChange={setNodeFilter}
          onClose={() => setSearchOpen(false)}
          onFocus={(element) => {
            focusElement(element);
            setSearchOpen(false);
          }}
          onSelectVisible={() => selectElements(filteredElements.map((element) => element.id))}
          onDeleteVisible={() => {
            removeElements(filteredElements.map((element) => element.id));
            setSearchOpen(false);
          }}
        />
      )}

      {navigatorOpen && (
        <CanvasNavigatorDrawer
          query={nodeSearch}
          filter={nodeFilter}
          elements={filteredElements}
          selectedIds={selectedIds}
          onQueryChange={setNodeSearch}
          onFilterChange={setNodeFilter}
          onClose={() => setNavigatorOpen(false)}
          onFocus={focusElement}
          onSelect={(id) => selectElements([id])}
          onRename={renameElement}
          onDuplicate={(id) => duplicateElements([id])}
          onDelete={(id) => removeElements([id])}
          onSelectVisible={() => selectElements(filteredElements.map((element) => element.id))}
        />
      )}

      {renameOpen && (
        <RenameCampaignDialog
          value={draftProjectName}
          pending={projectActionPending}
          onChange={setDraftProjectName}
          onClose={() => {
            setRenameOpen(false);
            setDraftProjectName(projectName);
          }}
          onSubmit={submitRenameProject}
        />
      )}

      {settingsOpen && (
        <CampaignSettingsDialog
          project={project}
          projectName={projectName}
          elementCount={elements.length}
          connectionCount={connections.length}
          selectedCount={selectedCount}
          saveStatus={saveStatus}
          autoSave={autoSave}
          onClose={() => setSettingsOpen(false)}
          onRename={() => {
            setSettingsOpen(false);
            setDraftProjectName(projectName);
            setRenameOpen(true);
          }}
        />
      )}

      {confirmAction && (
        <ConfirmDangerDialog
          action={confirmAction}
          projectName={projectName}
          elementCount={elements.length}
          confirmText={confirmText}
          pending={projectActionPending}
          onConfirmTextChange={setConfirmText}
          onClose={() => {
            setConfirmAction(null);
            setConfirmText("");
          }}
          onConfirm={() => {
            if (confirmAction === "clear-canvas") {
              clearCanvas();
              setConfirmAction(null);
              setConfirmText("");
              return;
            }
            submitDeleteProject();
          }}
        />
      )}
    </div>
  );
}
