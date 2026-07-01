"use client";

import { FolderOpen } from "lucide-react";
import { Panel } from "./panel";

export function ProjectsPanel() {
  return (
    <Panel title="Projects">
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <FolderOpen className="size-6 text-neutral-300" strokeWidth={1.5} />
        <p className="text-xs text-neutral-400">No projects yet</p>
      </div>
    </Panel>
  );
}