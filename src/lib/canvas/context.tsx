"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Camera,
  CanvasElement,
  Connection,
  NodeStatus,
  NodeType,
  ToolId,
  WorkflowState,
} from "@/types/canvas";
import {
  DEFAULT_FILL,
  DEFAULT_STROKE,
  DEFAULT_STROKE_WIDTH,
  NODE_CONFIG,
  isNodeTool,
} from "@/types/canvas";
import { useHistory } from "./use-history";
import { cloneElements } from "./clone";

type CanvasContextValue = {
  elements: CanvasElement[];
  selectedIds: string[];
  activeTool: ToolId;
  camera: Camera;
  connections: Connection[];
  clipboard: CanvasElement[];
  snapToGrid: boolean;
  showGrid: boolean;

  setActiveTool: (tool: ToolId) => void;
  toggleSnapToGrid: () => void;
  toggleShowGrid: () => void;
  addElement: (el: CanvasElement) => void;
  updateElement: (id: string, patch: Partial<CanvasElement>) => void;
  removeElements: (ids: string[]) => void;
  selectElements: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  moveElements: (ids: string[], dx: number, dy: number) => void;
  renameElement: (id: string, label: string) => void;
  setCamera: (cam: Camera | ((prev: Camera) => Camera)) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  addConnection: (fromId: string, toId: string) => void;
  removeConnection: (id: string) => void;
  updateNodeProperties: (id: string, properties: Record<string, string>) => void;
  updateNodeStatus: (
    id: string,
    status: NodeStatus,
    outputUrl?: string,
    error?: string,
    outputUrls?: string[]
  ) => void;

  copyToClipboard: (ids: string[]) => void;
  duplicateSelection: () => void;
  selectAll: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

const CanvasContext = createContext<CanvasContextValue | null>(null);

const STORAGE_KEY = "opencreative:canvas-v1";

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function loadFromStorage(): WorkflowState {
  if (typeof window === "undefined")
    return { elements: [], camera: { x: 0, y: 0, zoom: 1 }, connections: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw)
      return { elements: [], camera: { x: 0, y: 0, zoom: 1 }, connections: [] };
    const parsed = JSON.parse(raw);
    return {
      elements: parsed.elements ?? [],
      camera: parsed.camera ?? { x: 0, y: 0, zoom: 1 },
      connections: parsed.connections ?? [],
    };
  } catch {
    return { elements: [], camera: { x: 0, y: 0, zoom: 1 }, connections: [] };
  }
}

export function CanvasProvider({
  children,
  initial,
  onChange,
}: {
  children: ReactNode;
  initial?: WorkflowState;
  onChange?: (state: WorkflowState) => void;
}) {
  const initialState = initial ?? loadFromStorage();
  const history = useHistory(
    {
      elements: initialState.elements,
      connections: initialState.connections,
    },
    { max: 100 }
  );

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<ToolId>("select");
  const [camera, setCameraState] = useState<Camera>(initialState.camera);
  const [clipboard, setClipboard] = useState<CanvasElement[]>([]);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [mounted, setMounted] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const elements = history.present.elements;
  const connections = history.present.connections;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const state: WorkflowState = { elements, camera, connections };
    if (onChangeRef.current) {
      onChangeRef.current(state);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [elements, camera, connections, mounted]);

  const addElement = useCallback(
    (el: CanvasElement) => {
      history.set((prev) => ({
        ...prev,
        elements: [...prev.elements, el],
      }));
    },
    [history.set]
  );

  const updateElement = useCallback(
    (id: string, patch: Partial<CanvasElement>) => {
      history.set((prev) => ({
        ...prev,
        elements: prev.elements.map((el) =>
          el.id === id ? { ...el, ...patch } : el
        ),
      }));
    },
    [history.set]
  );

  const removeElements = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      history.set((prev) => ({
        elements: prev.elements.filter((el) => !idSet.has(el.id)),
        connections: prev.connections.filter(
          (c) => !idSet.has(c.fromId) && !idSet.has(c.toId)
        ),
      }));
      setSelectedIds((prev) => prev.filter((id) => !idSet.has(id)));
    },
    [history.set]
  );

  const selectElements = useCallback(
    (ids: string[]) => setSelectedIds(ids),
    []
  );

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const renameElement = useCallback(
    (id: string, label: string) => {
      history.set((prev) => ({
        ...prev,
        elements: prev.elements.map((el) =>
          el.id === id ? { ...el, customLabel: label } : el
        ),
      }));
    },
    [history.set]
  );

  const moveElements = useCallback(
    (ids: string[], dx: number, dy: number) => {
      history.set((prev) => ({
        ...prev,
        elements: prev.elements.map((el) => {
          if (!ids.includes(el.id)) return el;
          if (el.points) {
            return {
              ...el,
              points: el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
            };
          }
          return { ...el, x: el.x + dx, y: el.y + dy };
        }),
      }));
    },
    [history.set]
  );

  const setCamera = useCallback(
    (cam: Camera | ((prev: Camera) => Camera)) => {
      setCameraState(cam);
    },
    []
  );

  const toggleSnapToGrid = useCallback(() => {
    setSnapToGrid((prev) => !prev);
  }, []);

  const toggleShowGrid = useCallback(() => {
    setShowGrid((prev) => !prev);
  }, []);

  const bringToFront = useCallback(
    (id: string) => {
      history.set((prev) => {
        const idx = prev.elements.findIndex((el) => el.id === id);
        if (idx === -1) return prev;
        const next = [...prev.elements];
        const [el] = next.splice(idx, 1);
        next.push(el);
        return { ...prev, elements: next };
      });
    },
    [history.set]
  );

  const sendToBack = useCallback(
    (id: string) => {
      history.set((prev) => {
        const idx = prev.elements.findIndex((el) => el.id === id);
        if (idx === -1) return prev;
        const next = [...prev.elements];
        const [el] = next.splice(idx, 1);
        next.unshift(el);
        return { ...prev, elements: next };
      });
    },
    [history.set]
  );

  const copyToClipboard = useCallback(
    (ids: string[]) => {
      const items = history.present.elements.filter((el) => ids.includes(el.id));
      setClipboard(cloneElements(items, 0, 0));
    },
    [history.present.elements]
  );

  const duplicateSelection = useCallback(() => {
    if (selectedIds.length === 0) return;
    const clones = cloneElements(
      history.present.elements.filter((el) => selectedIds.includes(el.id)),
      20,
      20
    );
    clones.forEach((el) => addElement(el));
    selectElements(clones.map((el) => el.id));
  }, [history.present.elements, selectedIds, addElement, selectElements]);

  const selectAll = useCallback(() => {
    selectElements(history.present.elements.map((el) => el.id));
  }, [history.present.elements, selectElements]);

  const addConnection = useCallback(
    (fromId: string, toId: string) => {
      history.set((prev) => {
        if (prev.connections.some((c) => c.fromId === fromId && c.toId === toId))
          return prev;
        return {
          ...prev,
          connections: [...prev.connections, { id: uid(), fromId, toId }],
        };
      });
    },
    [history.set]
  );

  const removeConnection = useCallback(
    (id: string) => {
      history.set((prev) => ({
        ...prev,
        connections: prev.connections.filter((c) => c.id !== id),
      }));
    },
    [history.set]
  );

  const updateNodeProperties = useCallback(
    (id: string, properties: Record<string, string>) => {
      history.set((prev) => ({
        ...prev,
        elements: prev.elements.map((el) =>
          el.id === id && el.nodeData
            ? { ...el, nodeData: { ...el.nodeData, properties } }
            : el
        ),
      }));
    },
    [history.set]
  );

  const updateNodeStatus = useCallback(
    (id: string, status: NodeStatus, outputUrl?: string, error?: string, outputUrls?: string[]) => {
      history.set((prev) => ({
        ...prev,
        elements: prev.elements.map((el) =>
          el.id === id && el.nodeData
            ? {
                ...el,
                nodeData: {
                  ...el.nodeData,
                  status,
                  outputUrl,
                  error,
                  ...(outputUrls !== undefined ? { outputUrls } : {}),
                },
              }
            : el
        ),
      }));
    },
    [history.set]
  );

  const value = useMemo<CanvasContextValue>(
    () => ({
      elements,
      selectedIds,
      activeTool,
      camera,
      connections,
      clipboard,
      snapToGrid,
      showGrid,
      setActiveTool,
      toggleSnapToGrid,
      toggleShowGrid,
      addElement,
      updateElement,
      removeElements,
      selectElements,
      toggleSelection,
      clearSelection,
      moveElements,
      renameElement,
      setCamera,
      bringToFront,
      sendToBack,
      addConnection,
      removeConnection,
      updateNodeProperties,
      updateNodeStatus,
      copyToClipboard,
      duplicateSelection,
      selectAll,
      undo: history.undo,
      redo: history.redo,
      canUndo: history.canUndo,
      canRedo: history.canRedo,
    }),
    [
      elements,
      selectedIds,
      activeTool,
      camera,
      connections,
      clipboard,
      snapToGrid,
      showGrid,
      addElement,
      updateElement,
      removeElements,
      selectElements,
      toggleSelection,
      clearSelection,
      moveElements,
      renameElement,
      setCamera,
      bringToFront,
      sendToBack,
      addConnection,
      removeConnection,
      updateNodeProperties,
      updateNodeStatus,
      copyToClipboard,
      duplicateSelection,
      selectAll,
      toggleSnapToGrid,
      toggleShowGrid,
      history.undo,
      history.redo,
      history.canUndo,
      history.canRedo,
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

export function newNode(nodeType: NodeType, x: number, y: number): CanvasElement {
  const cfg = NODE_CONFIG[nodeType];
  return {
    id: uid(),
    type: nodeType,
    x,
    y,
    width: cfg.w,
    height: cfg.h,
    stroke: "#171717",
    fill: "#ffffff",
    strokeWidth: 1.5,
    nodeData: {
      nodeType,
      label: cfg.label,
      properties: { ...cfg.defaultProps },
      status: "idle",
    },
  };
}
