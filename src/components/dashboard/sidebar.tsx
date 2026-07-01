import { ProjectsPanel, ToolsPanel, AIPanel } from "./panels";

export function Sidebar() {
  return (
    <aside className="flex h-dvh w-64 flex-col overflow-y-auto border-r border-neutral-200 bg-neutral-50">
      <header className="flex items-center gap-2.5 border-b border-neutral-200 px-4 py-3.5">
        <div className="flex size-6 items-center justify-center rounded-md bg-neutral-900 text-white">
          <span className="text-xs font-bold">OC</span>
        </div>
        <span className="text-sm font-semibold tracking-tight text-neutral-900">
          OpenCreative
        </span>
      </header>
      <nav className="flex-1">
        <ProjectsPanel />
        <ToolsPanel />
        <AIPanel />
      </nav>
    </aside>
  );
}
