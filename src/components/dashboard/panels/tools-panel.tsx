"use client";

import { Panel } from "./panel";

const tools = [
  { id: "select", label: "Select", shortcut: "V" },
  { id: "draw", label: "Draw", shortcut: "D" },
  { id: "rectangle", label: "Rectangle", shortcut: "R" },
  { id: "ellipse", label: "Ellipse", shortcut: "O" },
  { id: "line", label: "Line", shortcut: "L" },
  { id: "text", label: "Text", shortcut: "T" },
] as const;

export function ToolsPanel() {
  return (
    <Panel title="Tools">
      <div className="space-y-1">
        {tools.map((tool) => (
          <button
            key={tool.id}
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-zinc-800 transition-colors"
          >
            <span>{tool.label}</span>
            <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-500">
              {tool.shortcut}
            </kbd>
          </button>
        ))}
      </div>
    </Panel>
  );
}
