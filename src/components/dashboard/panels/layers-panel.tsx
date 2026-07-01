"use client";

import { Layers, Trash2 } from "lucide-react";
import { Panel } from "./panel";
import { useCanvas } from "@/lib/canvas/context";

export function LayersPanel() {
  const {
    elements,
    selectedIds,
    selectElements,
    removeElements,
    bringToFront,
    sendToBack,
  } = useCanvas();

  return (
    <Panel title="Layers">
      {elements.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Layers className="size-6 text-neutral-300" strokeWidth={1.5} />
          <p className="text-xs text-neutral-400">No layers yet</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {[...elements].reverse().map((el) => {
            const isSel = selectedIds.includes(el.id);
            const label =
              el.type === "text" ? el.text || "Text" : el.type;
            return (
              <li key={el.id} className="flex items-center gap-1">
                <button
                  onClick={() => selectElements(isSel ? [] : [el.id])}
                  className={`flex-1 truncate rounded px-2 py-1.5 text-left text-xs capitalize transition-colors ${
                    isSel
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}