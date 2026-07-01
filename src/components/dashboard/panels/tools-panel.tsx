"use client";

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
  type LucideIcon,
} from "lucide-react";
import { Panel } from "./panel";
import { useCanvas } from "@/lib/canvas/context";
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
  const { activeTool, setActiveTool } = useCanvas();

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
    </>
  );
}