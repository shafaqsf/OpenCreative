"use client";

import { Layers } from "lucide-react";
import { Panel } from "./panel";

export function LayersPanel() {
  return (
    <Panel title="Layers">
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <Layers className="size-6 text-neutral-300" strokeWidth={1.5} />
        <p className="text-xs text-neutral-400">No layers yet</p>
      </div>
    </Panel>
  );
}