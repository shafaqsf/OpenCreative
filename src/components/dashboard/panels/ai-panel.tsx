"use client";

import { Sparkles } from "lucide-react";
import { Panel } from "./panel";

export function AIPanel() {
  return (
    <Panel title="AI" defaultOpen={false}>
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <Sparkles className="size-6 text-neutral-300" strokeWidth={1.5} />
        <p className="text-xs text-neutral-400">AI features coming soon</p>
      </div>
    </Panel>
  );
}