"use client";

import type { CanvasElement } from "@/types/canvas";

function getBounds(el: CanvasElement) {
  if (el.points && el.points.length > 0) {
    const xs = el.points.map((p) => p.x);
    const ys = el.points.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return { minX, minY, w: maxX - minX, h: maxY - minY };
  }
  const w = el.width >= 0 ? el.width : -el.width;
  const h = el.height >= 0 ? el.height : -el.height;
  const minX = el.width >= 0 ? el.x : el.x + el.width;
  const minY = el.height >= 0 ? el.y : el.y + el.height;
  return { minX, minY, w, h };
}

function hitTest(el: CanvasElement, x: number, y: number): boolean {
  const { minX, minY, w, h } = getBounds(el);
  const pad = 6;
  return (
    x >= minX - pad &&
    x <= minX + w + pad &&
    y >= minY - pad &&
    y <= minY + h + pad
  );
}

export function getElementAtPoint(
  elements: CanvasElement[],
  x: number,
  y: number
): CanvasElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    if (hitTest(elements[i], x, y)) return elements[i];
  }
  return null;
}

export { getBounds };