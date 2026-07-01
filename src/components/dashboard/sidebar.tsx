import { ProjectsPanel, ToolsPanel, AIPanel, LayersPanel } from "./panels";

export function Sidebar() {
  return (
    <aside className="flex h-dvh w-64 flex-col overflow-y-auto border-r border-zinc-800 bg-zinc-900">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
        <span className="size-2 rounded-full bg-emerald-500" />
        <span className="text-sm font-semibold text-zinc-100">OpenCreative</span>
      </div>
      <nav className="flex-1">
        <ProjectsPanel />
        <ToolsPanel />
        <LayersPanel />
        <AIPanel />
      </nav>
      <div className="border-t border-zinc-800 px-4 py-3 text-xs text-zinc-600">
        OpenSource — v0.1.0
      </div>
    </aside>
  );
}
