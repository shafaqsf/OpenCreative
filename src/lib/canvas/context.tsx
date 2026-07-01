"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Camera, CanvasElement, Point, ToolId } from "@/types/canvas";
import {
  DEFAULT_FILL,
  DEFAULT_STROKE,
  DEFAULT_STROKE_WIDTH,
} from "@/types/canvas";

type CanvasContextValue = {
  elements: CanvasElement[];
  selectedIds: string[];
  activeTool: ToolId;
  camera: Camera;

  setActiveTool: (tool: ToolId) => void;
  addElement: (el: CanvasElement) => void;
  updateElement: (id: string, patch: Partial<CanvasElement>) => void;
  removeElements: (ids: string[]) => void;
  selectElements: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  moveElements: (ids: string[], dx: number, dy: number) => void;
  setCamera: (cam: Camera | ((prev: Camera) => Camera)) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
};

const CanvasContext = createContext<CanvasContextValue | null>(null);

const STORAGE_KEY = "opencreative:canvas-v1";

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function loadFromStorage(): { elements: CanvasElement[]; camera: Camera } {
  if (typeof window === "undefined")
    return { elements: [], camera: { x: 0, y: 0, zoom: 1 } };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw)
      return { elements: [], camera: { x: 0, y: 0, zoom: 1 } };
    const parsed = JSON.parse(raw);
    return {
      elements: parsed.elements ?? [],
      camera: parsed.camera ?? { x: 0, y: 0, zoom: 1 },
    };
  } catch {
    return { elements: [], camera: { x: 0, y: 0, zoom: 1 } };
  }
}

export function CanvasProvider({ children }: { children: ReactNode }) {
  const [elements, setElements] = useState<CanvasElement[]>(() =>
    loadFromStorage().elements
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<ToolId>("select");
  const [camera, setCameraState] = useState<Camera>(() =>
    loadFromStorage().camera
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ elements, camera })
    );
  }, [elements, camera, mounted]);

  const addElement = useCallback((el: CanvasElement) => {
    setElements((prev) => [...prev, el]);
  }, []);

  const updateElement = useCallback(
    (id: string, patch: Partial<CanvasElement>) => {
      setElements((prev) =>
        prev.map((el) => (el.id === id ? { ...el, ...patch } : el))
      );
    },
    []
  );

  const removeElements = useCallback((ids: string[]) => {
    setElements((prev) => prev.filter((el) => !ids.includes(el.id)));
    setSelectedIds((prev) =>
      prev.filter((id) => !ids.includes(id))
    );
  }, []);

  const selectElements = useCallback(
    (ids: string[]) => setSelectedIds(ids),
    []
  );

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  }, []);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const moveElements = useCallback((ids: string[], dx: number, dy: number) => {
    setElements((prev) =>
      prev.map((el) => {
        if (!ids.includes(el.id)) return el;
        if (el.points) {
          return {
            ...el,
            points: el.points.map((p) => ({
              x: p.x + dx,
              y: p.y + dy,
            })),
          };
        }
        return { ...el, x: el.x + dx, y: el.y + dy };
      })
    );
  }, []);

  const setCamera = useCallback(
    (cam: Camera | ((prev: Camera) => Camera)) => {
      setCameraState(cam);
    },
    []
  );

  const bringToFront = useCallback((id: string) => {
    setElements((prev) => {
      const idx = prev.findIndex((el) => el.id === id);
      if (idx === -1) return prev;
      const [el] = prev.splice(idx, 1);
      prev.push(el);
      return [...prev];
    });
  }, []);

  const sendToBack = useCallback((id: string) => {
    setElements((prev) => {
      const idx = prev.findIndex((el) => el.id === id);
      if (idx === -1) return prev;
      const [el] = prev.splice(idx, 1);
      prev.unshift(el);
      return [...prev];
    });
  }, []);

  const value = useMemo<CanvasContextValue>(
    () => ({
      elements,
      selectedIds,
      activeTool,
      camera,
      setActiveTool,
      addElement,
      updateElement,
      removeElements,
      selectElements,
      toggleSelection,
      clearSelection,
      moveElements,
      setCamera,
      bringToFront,
      sendToBack,
    }),
    [
      elements,
      selectedIds,
      activeTool,
      camera,
      addElement,
      updateElement,
      removeElements,
      selectElements,
      toggleSelection,
      clearSelection,
      moveElements,
      setCamera,
      bringToFront,
      sendToBack,
    ]
  );

  if (!mounted) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-white text-neutral-400">
        <span className="text-xs">Loading canvas…</span>
      </div>
    );
  }

  return (
    <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>
  );
}

export function useCanvas() {
  const ctx = useContext(CanvasContext);
  if (!ctx)
    throw new Error("useCanvas must be used within <CanvasProvider>");
  return ctx;
}

export function newElement(
  type: Exclude<ToolId, "select">,
  x: number,
  y: number
): CanvasElement {
  return {
    id: uid(),
    type,
    x,
    y,
    width: 0,
    height: 0,
    stroke: DEFAULT_STROKE,
    fill: DEFAULT_FILL,
    strokeWidth: DEFAULT_STROKE_WIDTH,
  };
}

export { uid };