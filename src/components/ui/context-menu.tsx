"use client";

import { useEffect, useRef } from "react";

export type ContextMenuItem =
  | { type: "separator" }
  | {
      type?: "item";
      label: string;
      shortcut?: string;
      disabled?: boolean;
      danger?: boolean;
      icon?: React.ReactNode;
      onClick: () => void;
    };

export function ContextMenu({
  open,
  x,
  y,
  items,
  onClose,
}: {
  open: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) {
        onClose();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="fixed z-[90] min-w-[10rem] rounded-lg border border-neutral-200 bg-white py-1 shadow-xl"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) =>
        item.type === "separator" ? (
          <div key={i} className="my-1 h-px bg-neutral-100" />
        ) : (
          <button
            key={i}
            disabled={item.disabled}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className={`flex w-full items-center justify-between gap-6 px-3 py-1.5 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              item.danger
                ? "text-red-600 hover:bg-red-50"
                : "text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            <span className="flex items-center gap-2">
              {item.icon}
              {item.label}
            </span>
            {item.shortcut && (
              <span className="text-[10px] text-neutral-400">{item.shortcut}</span>
            )}
          </button>
        )
      )}
    </div>
  );
}
