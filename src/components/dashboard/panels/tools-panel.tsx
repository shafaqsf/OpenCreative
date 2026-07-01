"use client";

import { useMemo, useState } from "react";
import {
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
  Image,
  Sparkles,
  LayoutTemplate,
  Plus,
  Save,
  Trash2,
  Copy,
  Pencil,
  Pin,
  type LucideIcon,
} from "lucide-react";
import { Panel } from "./panel";
import { useCanvas, uid } from "@/lib/canvas/context";
import {
  getBuiltInTemplates,
  instantiateTemplateAt,
  loadCustomTemplates,
  saveCustomTemplates,
  snapshotTemplate,
  sortTemplates,
  type Template,
} from "@/lib/canvas/presets";
import { useToast } from "@/lib/toast/context";
import type { ToolId } from "@/types/canvas";

const tools: {
  id: ToolId;
  label: string;
  Icon: LucideIcon;
  shortcut: string;
}[] = [
  { id: "select", label: "Select", Icon: MousePointer2, shortcut: "V" },
  { id: "rectangle", label: "Rectangle", Icon: Square, shortcut: "R" },
  { id: "ellipse", label: "Ellipse", Icon: Circle, shortcut: "O" },
  { id: "triangle", label: "Triangle", Icon: Triangle, shortcut: "G" },
  { id: "diamond", label: "Diamond", Icon: Diamond, shortcut: "H" },
  { id: "star", label: "Star", Icon: Star, shortcut: "S" },
  { id: "line", label: "Line", Icon: Minus, shortcut: "L" },
  { id: "arrow", label: "Arrow", Icon: ArrowRight, shortcut: "A" },
  { id: "text", label: "Text", Icon: Type, shortcut: "T" },
  { id: "draw", label: "Draw", Icon: PenLine, shortcut: "D" },
];

const nodes: { id: ToolId; label: string; Icon: LucideIcon; desc: string }[] = [
  { id: "prompt", label: "Prompt", Icon: FileText, desc: "Text prompt or instruction" },
  { id: "source", label: "Source", Icon: Image, desc: "Image/video URL or upload" },
  { id: "generate", label: "Generate", Icon: Sparkles, desc: "AI generation step" },
];

export function ToolsPanel() {
  const { activeTool, setActiveTool, addElement, addConnection, elements, selectedIds, connections, selectElements, camera } = useCanvas();
  const { addToast } = useToast();
  const [custom, setCustom] = useState<Template[]>(() => loadCustomTemplates());
  const [saveOpen, setSaveOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");

  const builtIn = useMemo(() => getBuiltInTemplates(), []);
  const visibleCustom = useMemo(
    () => sortTemplates(custom),
    [custom]
  );

  function handleSave() {
    if (!templateName.trim()) return;
    const selected = elements.filter((el) => selectedIds.includes(el.id));
    if (selected.length === 0) {
      addToast({ title: "No selection", message: "Select elements to save as a template.", variant: "warning" });
      return;
    }
    const template = snapshotTemplate({
      id: uid(),
      name: templateName.trim(),
      description: `${selected.length} element${selected.length === 1 ? "" : "s"}`,
      elements: selected,
      connections: connections.filter((conn) =>
        selectedIds.includes(conn.fromId) && selectedIds.includes(conn.toId)
      ),
      pinned: false,
      updatedAt: new Date().toISOString(),
    });
    const next = [...custom, template];
    setCustom(next);
    saveCustomTemplates(next);
    setTemplateName("");
    setSaveOpen(false);
    addToast({ title: "Template saved", message: `"${template.name}" saved.`, variant: "success" });
  }

  function deleteTemplate(id: string) {
    const next = custom.filter((t) => t.id !== id);
    setCustom(next);
    saveCustomTemplates(next);
  }

  function updateTemplate(id: string, patch: Partial<Template>) {
    const next = custom.map((template) =>
      template.id === id
        ? { ...template, ...patch, updatedAt: new Date().toISOString() }
        : template
    );
    setCustom(next);
    saveCustomTemplates(next);
  }

  function renameTemplate(template: Template) {
    const name = window.prompt("Rename template", template.name)?.trim();
    if (name && name !== template.name) {
      updateTemplate(template.id, { name });
    }
  }

  function duplicateTemplate(template: Template) {
    const duplicate = snapshotTemplate({
      ...template,
      id: uid(),
      name: `${template.name} copy`,
      pinned: false,
      updatedAt: new Date().toISOString(),
    });
    const next = [...custom, duplicate];
    setCustom(next);
    saveCustomTemplates(next);
    addToast({ title: "Template duplicated", message: `"${duplicate.name}" saved.`, variant: "success" });
  }

  function applyTemplateToCanvas(template: Template) {
    const viewportCenter = {
      x: (window.innerWidth / 2 - camera.x) / camera.zoom,
      y: (window.innerHeight / 2 - camera.y) / camera.zoom,
    };
    const instance = instantiateTemplateAt(template, viewportCenter);
    instance.elements.forEach(addElement);
    instance.connections.forEach((conn) => addConnection(conn.fromId, conn.toId));
    selectElements(instance.elements.map((el) => el.id));
    addToast({
      title: "Template applied",
      message: `"${template.name}" added with ${instance.elements.length} item${instance.elements.length === 1 ? "" : "s"}.`,
      variant: "success",
      duration: 2000,
    });
  }

  function startTemplateDrag(e: React.DragEvent, template: Template) {
    e.dataTransfer.setData("application/opencreative-template", template.id);
    e.dataTransfer.effectAllowed = "copy";
  }

  return (
    <>
      <Panel title="Annotate">
        <div className="grid grid-cols-4 gap-1">
          {tools.map(({ id, label, Icon, shortcut }) => (
            <button
              key={id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/opencreative-tool", id);
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => setActiveTool(id)}
              title={`${label} — ${shortcut}`}
              className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-md border text-xs transition-colors ${
                activeTool === id
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              }`}
            >
              <Icon className="size-4" strokeWidth={1.75} />
            </button>
          ))}
        </div>
      </Panel>
      <Panel title="Workflow">
        <div className="flex flex-col gap-1">
          {nodes.map(({ id, label, Icon, desc }) => (
            <button
              key={id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/opencreative-tool", id);
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => setActiveTool(id)}
              className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs transition-colors ${
                activeTool === id
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              }`}
            >
              <Icon className="size-3.5" strokeWidth={1.75} />
              <div className="text-left leading-tight">
                <div>{label}</div>
                <div className="text-[10px] opacity-60">{desc}</div>
              </div>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-neutral-400">
          Click a node, then click the canvas to place it. Drag from the right
          edge of one node to the left edge of another to connect.
        </p>
      </Panel>
      <Panel title="Templates" defaultOpen={false}>
        <div className="flex flex-col gap-1">
          {builtIn.map((template) => (
              <button
                key={template.id}
                draggable
                onDragStart={(e) => startTemplateDrag(e, template)}
                onClick={() => applyTemplateToCanvas(template)}
                title="Drag onto the canvas or click to insert"
                className="flex items-center gap-2 rounded-md border border-transparent px-2.5 py-2 text-left text-xs text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                <LayoutTemplate className="size-3.5" strokeWidth={1.75} />
                <div className="leading-tight">
                  <div>{template.name}</div>
                  <div className="text-[10px] opacity-60">{template.description}</div>
                </div>
              </button>
            ))}
          {visibleCustom.length === 0 && (
            <div className="rounded-md border border-dashed border-neutral-200 px-3 py-5 text-center text-[11px] text-neutral-400">
              No custom templates yet.
            </div>
          )}
          {visibleCustom.map((template) => (
            <div
              key={template.id}
              draggable
              onDragStart={(e) => startTemplateDrag(e, template)}
              className="group flex items-center gap-1 rounded-md border border-transparent px-2.5 py-2 text-xs text-neutral-600 hover:bg-neutral-100"
            >
              <button
                onClick={() => applyTemplateToCanvas(template)}
                title="Drag onto the canvas or click to insert"
                className="flex flex-1 items-center gap-2 text-left"
              >
                {template.pinned ? (
                  <Pin className="size-3.5 fill-neutral-900 text-neutral-900" strokeWidth={1.75} />
                ) : (
                  <Save className="size-3.5" strokeWidth={1.75} />
                )}
                <div className="leading-tight">
                  <div>{template.name}</div>
                  <div className="text-[10px] opacity-60">{template.description}</div>
                </div>
              </button>
              <button
                onClick={() => updateTemplate(template.id, { pinned: !template.pinned })}
                className="p-1 text-neutral-400 opacity-0 hover:text-neutral-900 group-hover:opacity-100"
                title={template.pinned ? "Unpin template" : "Pin template"}
              >
                <Pin className={`size-3 ${template.pinned ? "fill-neutral-900 text-neutral-900" : ""}`} />
              </button>
              <button
                onClick={() => renameTemplate(template)}
                className="p-1 text-neutral-400 opacity-0 hover:text-neutral-900 group-hover:opacity-100"
                title="Rename template"
              >
                <Pencil className="size-3" />
              </button>
              <button
                onClick={() => duplicateTemplate(template)}
                className="p-1 text-neutral-400 opacity-0 hover:text-neutral-900 group-hover:opacity-100"
                title="Duplicate template"
              >
                <Copy className="size-3" />
              </button>
              <button
                onClick={() => deleteTemplate(template.id)}
                className="p-1 text-neutral-400 opacity-0 hover:text-red-600 group-hover:opacity-100"
                title="Delete template"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>

        {saveOpen ? (
          <div className="mt-2 flex items-center gap-1">
            <input
              autoFocus
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setSaveOpen(false);
              }}
              placeholder="Template name"
              className="flex-1 rounded-md border border-neutral-200 px-2 py-1 text-[11px] outline-none focus:border-neutral-900"
            />
            <button
              onClick={handleSave}
              disabled={!templateName.trim()}
              className="rounded-md bg-neutral-900 p-1 text-white disabled:opacity-50"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSaveOpen(true)}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-neutral-200 px-2 py-1.5 text-[11px] font-medium text-neutral-600 transition-colors hover:bg-neutral-100"
          >
            <Save className="size-3.5" />
            Save selection as template
          </button>
        )}
      </Panel>
    </>
  );
}
