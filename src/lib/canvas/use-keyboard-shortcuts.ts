"use client";

import { useEffect } from "react";
import { useCanvas } from "@/lib/canvas/context";
import type { ToolId } from "@/types/canvas";

const SHORTCUTS: Record<string, ToolId> = {
  v: "select",
  r: "rectangle",
  o: "ellipse",
  l: "line",
  a: "arrow",
  t: "text",
  d: "draw",
};

export function useKeyboardShortcuts() {
  const { setActiveTool, removeElements, selectedIds } = useCanvas();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.length > 0) {
          e.preventDefault();
          removeElements(selectedIds);
        }
        return;
      }

      const tool = SHORTCUTS[e.key.toLowerCase()];
      if (tool && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setActiveTool(tool);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setActiveTool, removeElements, selectedIds]);
}