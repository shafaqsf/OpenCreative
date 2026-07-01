"use client";

import { useState } from "react";
import { Layers, X } from "lucide-react";
import { Panel } from "./panel";
import { useCanvas } from "@/lib/canvas/context";

function layerName(el: { type: string; customLabel?: string; nodeData?: { label?: string }; text?: string }): string {
  if (el.customLabel) return el.customLabel;
  if (el.nodeData?.label) return el.nodeData.label;
  if (el.type === "text" && el.text) return el.text.slice(0, 20) || el.type;
  return el.type;
}

export function LayersPanel() {
  const { elements, selectedIds, selectElements, removeElements, renameElement } = useCanvas();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  function startRename(id: string) {
    const el = elements.find((e) => e.id === id);
    if (!el) return;
    setEditingId(id);
    setEditValue(el.customLabel || layerName(el));
  }

  function commitRename() {
    if (editingId && editValue.trim()) {
      renameElement(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue("");
  }

  return (
    <Panel title="Layers">
      {elements.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Layers className="size-6 text-neutral-300" strokeWidth={1.5} />
          <p className="text-xs text-neutral-400">No layers yet</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-px">
          {[...elements].reverse().map((el) => {
            const isSel = selectedIds.includes(el.id);
            const name = layerName(el);

            return (
              <li
                key={el.id}
                className={`group flex items-center border border-transparent rounded ${
                  isSel ? "border-neutral-300 bg-neutral-100" : "hover:bg-neutral-50"
                }`}
              >
                <button
                  onClick={() => selectElements(isSel ? [] : [el.id])}
                  className="flex-1 truncate px-2 py-1 text-left text-xs text-neutral-700"
                >
                  {editingId === el.id ? (
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full rounded border border-neutral-400 bg-white px-1 py-0.5 text-xs outline-none"
                    />
                  ) : (
                    <span
                      onDoubleClick={() => startRename(el.id)}
                      className="truncate block"
                    >
                      {name}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => removeElements([el.id])}
                  title="Delete layer"
                  className="p-1 text-neutral-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="size-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}