"use client";

import { useCallback, useEffect, useState } from "react";

export function useResizablePanel(
  key: string,
  defaultWidth: number,
  options: { min?: number; max?: number } = {}
) {
  const { min = 180, max = 480 } = options;
  const [width, setWidth] = useState(defaultWidth);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(`opencreative:panel:${key}`);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed)) setWidth(Math.max(min, Math.min(max, parsed)));
    }
  }, [key, min, max]);

  const persist = useCallback(
    (next: number) => {
      const clamped = Math.max(min, Math.min(max, next));
      setWidth(clamped);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          `opencreative:panel:${key}`,
          String(clamped)
        );
      }
    },
    [key, min, max]
  );

  const startResize = useCallback(
    (direction: 1 | -1) =>
      (e: React.PointerEvent) => {
        e.preventDefault();
        setIsDragging(true);
        const startX = e.clientX;
        const startWidth = width;

        function onMove(ev: PointerEvent) {
          const delta = (ev.clientX - startX) * direction;
          persist(startWidth + delta);
        }

        function onUp() {
          setIsDragging(false);
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
        }

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
      },
    [width, persist]
  );

  return { width, isDragging, persist, startResize };
}

export function ResizableHandle({
  onPointerDown,
  className = "",
}: {
  onPointerDown: (e: React.PointerEvent) => void;
  className?: string;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      className={`absolute z-30 w-1 cursor-ew-resize bg-transparent hover:bg-blue-400/30 active:bg-blue-500/50 ${className}`}
    />
  );
}
