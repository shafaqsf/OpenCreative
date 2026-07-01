"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Panel } from "./panel";
import { useCanvas, newNode } from "@/lib/canvas/context";
import { useToast } from "@/lib/toast/context";
import type { NodeType } from "@/types/canvas";

type AssistantNode = {
  type: NodeType;
  x: number;
  y: number;
  properties: Record<string, string>;
};

export function AIPanel() {
  const { addElement, addConnection } = useCanvas();
  const { addToast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "Assistant failed");
      }
      const nodes: AssistantNode[] = json.nodes || [];
      const connections: { from: number; to: number }[] = json.connections || [];
      if (nodes.length === 0) {
        throw new Error("No nodes returned");
      }

      const created = nodes.map((n) => {
        const el = newNode(n.type, n.x, n.y);
        el.nodeData!.properties = { ...el.nodeData!.properties, ...n.properties };
        return el;
      });
      created.forEach(addElement);
      connections.forEach((c) => {
        const from = created[c.from];
        const to = created[c.to];
        if (from && to) addConnection(from.id, to.id);
      });

      addToast({
        title: "Workflow generated",
        message: `Added ${created.length} node${created.length === 1 ? "" : "s"} to the canvas.`,
        variant: "success",
      });
      setPrompt("");
    } catch (err) {
      addToast({
        title: "Assistant error",
        message: err instanceof Error ? err.message : "Could not generate workflow",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel title="AI Assistant" defaultOpen={false}>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <p className="text-[10px] leading-relaxed text-neutral-400">
          Describe the workflow you want and the AI will build it on the canvas.
        </p>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Create a workflow that takes a prompt, generates 3 images, and shows them in output nodes"
          rows={3}
          className="w-full rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-xs outline-none transition-colors focus:border-neutral-900 resize-none"
        />
        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          {loading ? "Generating…" : "Generate workflow"}
        </button>
      </form>
    </Panel>
  );
}
