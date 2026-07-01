"use client";

import { useState, type ReactNode } from "react";

export function Panel({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-zinc-800">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
      >
        <span className="text-xs tabular-nums">{open ? "▾" : "▸"}</span>
        {title}
      </button>
      {open && <div className="px-4 pb-3 text-sm text-zinc-300">{children}</div>}
    </div>
  );
}
