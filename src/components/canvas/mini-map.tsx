"use client";

import { useCallback, useRef } from "react";
import { useCanvas } from "@/lib/canvas/context";
import { getBounds } from "@/lib/canvas/hit-test";

const WIDTH = 160;
const HEIGHT = 120;
const PADDING = 40;

export function MiniMap() {
  const { elements, camera, setCamera } = useCanvas();
  const ref = useRef<HTMLDivElement>(null);

  const bounds = (() => {
    if (elements.length === 0) {
      return { minX: -200, minY: -150, w: 400, h: 300 };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const el of elements) {
      const b = getBounds(el);
      minX = Math.min(minX, b.minX);
      minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.minX + b.w);
      maxY = Math.max(maxY, b.minY + b.h);
    }
    return {
      minX: minX - PADDING,
      minY: minY - PADDING,
      w: maxX - minX + PADDING * 2,
      h: maxY - minY + PADDING * 2,
    };
  })();

  const scale = Math.min(WIDTH / bounds.w, HEIGHT / bounds.h);

  const toMapX = useCallback(
    (worldX: number) => (worldX - bounds.minX) * scale,
    [bounds.minX, scale]
  );
  const toMapY = useCallback(
    (worldY: number) => (worldY - bounds.minY) * scale,
    [bounds.minY, scale]
  );
  const toWorldX = useCallback(
    (mapX: number) => mapX / scale + bounds.minX,
    [bounds.minX, scale]
  );
  const toWorldY = useCallback(
    (mapY: number) => mapY / scale + bounds.minY,
    [bounds.minY, scale]
  );

  // Viewport in world coords
  const container = ref.current?.parentElement?.parentElement as HTMLElement | null;
  const viewportW = container ? container.clientWidth / camera.zoom : 0;
  const viewportH = container ? container.clientHeight / camera.zoom : 0;
  const viewportX = -camera.x / camera.zoom;
  const viewportY = -camera.y / camera.zoom;

  function handleClick(e: React.MouseEvent) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const worldX = toWorldX(mx);
    const worldY = toWorldY(my);
    setCamera((prev) => ({
      ...prev,
      x: -worldX * prev.zoom + (container?.clientWidth ?? 0) / 2,
      y: -worldY * prev.zoom + (container?.clientHeight ?? 0) / 2,
    }));
  }

  return (
    <div
      ref={ref}
      className="absolute bottom-4 right-4 z-20 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm"
      style={{ width: WIDTH, height: HEIGHT }}
      onClick={handleClick}
    >
      <div className="relative h-full w-full">
        {elements.map((el) => {
          const b = getBounds(el);
          return (
            <div
              key={el.id}
              className="absolute rounded-[1px] bg-neutral-400"
              style={{
                left: toMapX(b.minX),
                top: toMapY(b.minY),
                width: Math.max(2, b.w * scale),
                height: Math.max(2, b.h * scale),
              }}
            />
          );
        })}
        <div
          className="absolute border border-blue-500 bg-blue-500/10"
          style={{
            left: toMapX(viewportX),
            top: toMapY(viewportY),
            width: Math.max(4, viewportW * scale),
            height: Math.max(4, viewportH * scale),
          }}
        />
      </div>
    </div>
  );
}
