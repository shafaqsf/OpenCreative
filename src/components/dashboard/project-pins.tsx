"use client";

import { useCallback, useEffect, useState } from "react";
import { Pin } from "lucide-react";

const STORAGE_KEY = "opencreative:pinned-projects";

export function usePinnedProjects() {
  const [pinned, setPinned] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setPinned(new Set(JSON.parse(raw)));
    } catch {}
  }, []);

  const persist = useCallback((next: Set<string>) => {
    setPinned(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
    }
  }, []);

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(pinned);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persist(next);
    },
    [pinned, persist]
  );

  return { pinned, toggle };
}

export function PinButton({
  projectId,
  pinned,
  onToggle,
}: {
  projectId: string;
  pinned: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle(projectId);
      }}
      className={`rounded p-1 transition-colors ${
        pinned
          ? "bg-blue-100 text-blue-600"
          : "text-neutral-300 hover:bg-neutral-100 hover:text-neutral-500"
      }`}
      title={pinned ? "Unpin project" : "Pin project"}
    >
      <Pin className={`size-3.5 ${pinned ? "fill-blue-600" : ""}`} />
    </button>
  );
}
