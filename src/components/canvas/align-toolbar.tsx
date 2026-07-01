"use client";

import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  ArrowRightLeft,
  ArrowUpDown,
} from "lucide-react";
import { useCanvas } from "@/lib/canvas/context";

const buttonCls =
  "flex size-7 items-center justify-center rounded text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors";

export function AlignToolbar() {
  const { selectedIds, alignSelection, distributeSelection } = useCanvas();
  if (selectedIds.length < 2) return null;

  return (
    <div className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-neutral-200 bg-white px-1.5 py-1 shadow-sm">
      <button
        title="Align left"
        onClick={() => alignSelection("left")}
        className={buttonCls}
      >
        <AlignLeft className="size-3.5" strokeWidth={1.75} />
      </button>
      <button
        title="Align center horizontally"
        onClick={() => alignSelection("center-h")}
        className={buttonCls}
      >
        <AlignCenter className="size-3.5" strokeWidth={1.75} />
      </button>
      <button
        title="Align right"
        onClick={() => alignSelection("right")}
        className={buttonCls}
      >
        <AlignRight className="size-3.5" strokeWidth={1.75} />
      </button>
      <div className="mx-1 h-4 w-px bg-neutral-200" />
      <button
        title="Align top"
        onClick={() => alignSelection("top")}
        className={buttonCls}
      >
        <AlignVerticalJustifyStart className="size-3.5" strokeWidth={1.75} />
      </button>
      <button
        title="Align center vertically"
        onClick={() => alignSelection("center-v")}
        className={buttonCls}
      >
        <AlignVerticalJustifyCenter className="size-3.5" strokeWidth={1.75} />
      </button>
      <button
        title="Align bottom"
        onClick={() => alignSelection("bottom")}
        className={buttonCls}
      >
        <AlignVerticalJustifyEnd className="size-3.5" strokeWidth={1.75} />
      </button>
      {selectedIds.length >= 3 && (
        <>
          <div className="mx-1 h-4 w-px bg-neutral-200" />
          <button
            title="Distribute horizontally"
            onClick={() => distributeSelection("horizontal")}
            className={buttonCls}
          >
            <ArrowRightLeft className="size-3.5" strokeWidth={1.75} />
          </button>
          <button
            title="Distribute vertically"
            onClick={() => distributeSelection("vertical")}
            className={buttonCls}
          >
            <ArrowUpDown className="size-3.5" strokeWidth={1.75} />
          </button>
        </>
      )}
    </div>
  );
}
