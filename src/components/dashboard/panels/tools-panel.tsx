"use client";

import {
  MousePointer2,
  Square,
  Circle,
  Minus,
  ArrowRight,
  Type,
  PenLine,
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
  { id: "line", label: "Line", Icon: Minus, shortcut: "L" },
  { id: "arrow", label: "Arrow", Icon: ArrowRight, shortcut: "A" },
  { id: "text", label: "Text", Icon: Type, shortcut: "T" },
  { id: "draw", label: "Draw", Icon: PenLine, shortcut: "D" },
];

export function ToolsPanel() {
  const { activeTool, setActiveTool } = useCanvas();

  return (
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
  );
}