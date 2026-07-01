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
  MessageSquare,
  Image,
  Video,
  Upload,
  SquareArrowOutUpRight,
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

const nodes: { id: ToolId; label: string; Icon: LucideIcon }[] = [
  { id: "node_prompt", label: "Prompt", Icon: MessageSquare },
  { id: "node_image", label: "Image", Icon: Image },
  { id: "node_video", label: "Video", Icon: Video },
  { id: "node_upload", label: "Upload", Icon: Upload },
  { id: "node_output", label: "Output", Icon: SquareArrowOutUpRight },
];

export function ToolsPanel() {
  const { activeTool, setActiveTool } = useCanvas();

  return (
    <>
      <Panel title="Tools">
        <div className="grid grid-cols-4 gap-1">
          {tools.map(({ id, label, Icon, shortcut }) => {
            const isActive = activeTool === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTool(id)}
                title={`${label} — ${shortcut}`}
                className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-md border text-xs transition-colors ${
                  isActive
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                <Icon className="size-4" strokeWidth={1.75} />
              </button>
            );
          })}
        </div>
      </Panel>
      <Panel title="Workflow nodes">
        <div className="grid grid-cols-2 gap-1">
          {nodes.map(({ id, label, Icon }) => {
            const isActive = activeTool === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTool(id)}
                title={label}
                className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors ${
                  isActive
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                <Icon className="size-3.5" strokeWidth={1.75} />
                {label}
              </button>
            );
          })}
        </div>
      </Panel>
    </>
  );
}