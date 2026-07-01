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
import { getBounds } from "./hit-test";

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
  addElements: (newElements: CanvasElement[], newConnections?: Connection[]) => void;
  updateElement: (id: string, patch: Partial<CanvasElement>) => void;
  removeElements: (ids: string[]) => void;
  selectElements: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  moveElements: (ids: string[], dx: number, dy: number) => void;
  renameElement: (id: string, label: string) => void;
  setCamera: (cam: Camera | ((prev: Camera) => Camera)) => void;
  replaceWorkflow: (state: WorkflowState) => void;
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
  alignSelection: (alignment: "left" | "center-h" | "right" | "top" | "center-v" | "bottom") => void;
  distributeSelection: (axis: "horizontal" | "vertical") => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  runWorkflow?: () => void;
  setRunWorkflow: (fn: (() => void) | undefined) => void;
};

const CanvasContext = createContext<CanvasContextValue | null>(null);

const STORAGE_KEY = "opencreative:canvas-v1";

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function loadFromStorage(): WorkflowState {
  if (typeof window === "undefined")
    return {
      elements: [],
      camera: { x: 0, y: 0, zoom: 1 },
      connections: [],
      ui: { snapToGrid: true, showGrid: true },
    };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw)
      return { elements: [], camera: { x: 0, y: 0, zoom: 1 }, connections: [] };
    const parsed = JSON.parse(raw);
    return {
      elements: parsed.elements ?? [],
      camera: parsed.camera ?? { x: 0, y: 0, zoom: 1 },
      connections: parsed.connections ?? [],
      ui: parsed.ui ?? { snapToGrid: true, showGrid: true },
    };
  } catch {
    return {
      elements: [],
      camera: { x: 0, y: 0, zoom: 1 },
      connections: [],
      ui: { snapToGrid: true, showGrid: true },
    };
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
  const {
    present,
    set: setHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory(
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
  const [snapToGrid, setSnapToGrid] = useState(initialState.ui?.snapToGrid ?? true);
  const [showGrid, setShowGrid] = useState(initialState.ui?.showGrid ?? true);
  const [mounted, setMounted] = useState(false);
  const [runWorkflow, setRunWorkflowState] = useState<(() => void) | undefined>(undefined);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const elements = present.elements;
  const connections = present.connections;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const state: WorkflowState = {
      elements,
      camera,
      connections,
      ui: { snapToGrid, showGrid },
    };
    if (onChangeRef.current) {
      onChangeRef.current(state);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [elements, camera, connections, snapToGrid, showGrid, mounted]);

  const addElement = useCallback(
    (el: CanvasElement) => {
      setHistory((prev) => ({
        ...prev,
        elements: [...prev.elements, el],
      }));
    },
    [setHistory]
  );

  const addElements = useCallback(
    (newElements: CanvasElement[], newConnections: Connection[] = []) => {
      if (newElements.length === 0 && newConnections.length === 0) return;
      setHistory((prev) => {
        const seenConnections = new Set(
          prev.connections.map((conn) => `${conn.fromId}:${conn.toId}`)
        );
        const dedupedConnections = newConnections.filter((conn) => {
          const key = `${conn.fromId}:${conn.toId}`;
          if (seenConnections.has(key)) return false;
          seenConnections.add(key);
          return true;
        });

        return {
          ...prev,
          elements: [...prev.elements, ...newElements],
          connections: [...prev.connections, ...dedupedConnections],
        };
      });
    },
    [setHistory]
  );

  const updateElement = useCallback(
    (id: string, patch: Partial<CanvasElement>) => {
      setHistory((prev) => ({
        ...prev,
        elements: prev.elements.map((el) =>
          el.id === id ? { ...el, ...patch } : el
        ),
      }));
    },
    [setHistory]
  );

  const removeElements = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      setHistory((prev) => ({
        elements: prev.elements.filter((el) => !idSet.has(el.id)),
        connections: prev.connections.filter(
          (c) => !idSet.has(c.fromId) && !idSet.has(c.toId)
        ),
      }));
      setSelectedIds((prev) => prev.filter((id) => !idSet.has(id)));
    },
    [setHistory]
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
      setHistory((prev) => ({
        ...prev,
        elements: prev.elements.map((el) =>
          el.id === id ? { ...el, customLabel: label } : el
        ),
      }));
    },
    [setHistory]
  );

  const moveElements = useCallback(
    (ids: string[], dx: number, dy: number) => {
      setHistory((prev) => ({
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
    [setHistory]
  );

  const setCamera = useCallback(
    (cam: Camera | ((prev: Camera) => Camera)) => {
      setCameraState(cam);
    },
    []
  );

  const replaceWorkflow = useCallback(
    (state: WorkflowState) => {
      setHistory({
        elements: state.elements,
        connections: state.connections,
      });
      setCameraState(state.camera);
      setSnapToGrid(state.ui?.snapToGrid ?? true);
      setShowGrid(state.ui?.showGrid ?? true);
      setSelectedIds([]);
    },
    [setHistory]
  );

  const toggleSnapToGrid = useCallback(() => {
    setSnapToGrid((prev) => !prev);
  }, []);

  const toggleShowGrid = useCallback(() => {
    setShowGrid((prev) => !prev);
  }, []);

  const bringToFront = useCallback(
    (id: string) => {
      setHistory((prev) => {
        const idx = prev.elements.findIndex((el) => el.id === id);
        if (idx === -1) return prev;
        const next = [...prev.elements];
        const [el] = next.splice(idx, 1);
        next.push(el);
        return { ...prev, elements: next };
      });
    },
    [setHistory]
  );

  const sendToBack = useCallback(
    (id: string) => {
      setHistory((prev) => {
        const idx = prev.elements.findIndex((el) => el.id === id);
        if (idx === -1) return prev;
        const next = [...prev.elements];
        const [el] = next.splice(idx, 1);
        next.unshift(el);
        return { ...prev, elements: next };
      });
    },
    [setHistory]
  );

  const copyToClipboard = useCallback(
    (ids: string[]) => {
      const items = present.elements.filter((el) => ids.includes(el.id));
      setClipboard(cloneElements(items, 0, 0));
    },
    [present.elements]
  );

  const duplicateSelection = useCallback(() => {
    if (selectedIds.length === 0) return;
    const clones = cloneElements(
      present.elements.filter((el) => selectedIds.includes(el.id)),
      20,
      20
    );
    addElements(clones);
    selectElements(clones.map((el) => el.id));
  }, [present.elements, selectedIds, addElements, selectElements]);

  const selectAll = useCallback(() => {
    selectElements(present.elements.map((el) => el.id));
  }, [present.elements, selectElements]);

  const alignSelection = useCallback(
    (alignment: "left" | "center-h" | "right" | "top" | "center-v" | "bottom") => {
      const selected = present.elements.filter((el) =>
        selectedIds.includes(el.id)
      );
      if (selected.length < 2) return;
      const bounds = selected.map(getBounds);
      let target = 0;
      switch (alignment) {
        case "left":
          target = Math.min(...bounds.map((b) => b.minX));
          break;
        case "center-h":
          target =
            bounds.reduce((sum, b) => sum + b.minX + b.w / 2, 0) /
            bounds.length;
          break;
        case "right":
          target = Math.max(...bounds.map((b) => b.minX + b.w));
          break;
        case "top":
          target = Math.min(...bounds.map((b) => b.minY));
          break;
        case "center-v":
          target =
            bounds.reduce((sum, b) => sum + b.minY + b.h / 2, 0) /
            bounds.length;
          break;
        case "bottom":
          target = Math.max(...bounds.map((b) => b.minY + b.h));
          break;
      }
      setHistory((prev) => ({
        ...prev,
        elements: prev.elements.map((el) => {
          if (!selectedIds.includes(el.id)) return el;
          const b = getBounds(el);
          let dx = 0;
          let dy = 0;
          switch (alignment) {
            case "left":
              dx = target - b.minX;
              break;
            case "center-h":
              dx = target - (b.minX + b.w / 2);
              break;
            case "right":
              dx = target - (b.minX + b.w);
              break;
            case "top":
              dy = target - b.minY;
              break;
            case "center-v":
              dy = target - (b.minY + b.h / 2);
              break;
            case "bottom":
              dy = target - (b.minY + b.h);
              break;
          }
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
    [present.elements, selectedIds, setHistory]
  );

  const distributeSelection = useCallback(
    (axis: "horizontal" | "vertical") => {
      const selected = present.elements.filter((el) =>
        selectedIds.includes(el.id)
      );
      if (selected.length < 3) return;
      const withBounds = selected.map((el) => ({ el, b: getBounds(el) }));
      if (axis === "horizontal") {
        withBounds.sort((a, b) => a.b.minX - b.b.minX);
        const totalSpace =
          withBounds[withBounds.length - 1].b.minX -
          withBounds[0].b.minX;
        const step = totalSpace / (withBounds.length - 1);
        setHistory((prev) => ({
          ...prev,
          elements: prev.elements.map((el) => {
            const idx = withBounds.findIndex((item) => item.el.id === el.id);
            if (idx === -1) return el;
            const targetX = withBounds[0].b.minX + step * idx;
            const dx = targetX - withBounds[idx].b.minX;
            if (el.points) {
              return {
                ...el,
                points: el.points.map((p) => ({ x: p.x + dx, y: p.y })),
              };
            }
            return { ...el, x: el.x + dx, y: el.y };
          }),
        }));
      } else {
        withBounds.sort((a, b) => a.b.minY - b.b.minY);
        const totalSpace =
          withBounds[withBounds.length - 1].b.minY -
          withBounds[0].b.minY;
        const step = totalSpace / (withBounds.length - 1);
        setHistory((prev) => ({
          ...prev,
          elements: prev.elements.map((el) => {
            const idx = withBounds.findIndex((item) => item.el.id === el.id);
            if (idx === -1) return el;
            const targetY = withBounds[0].b.minY + step * idx;
            const dy = targetY - withBounds[idx].b.minY;
            if (el.points) {
              return {
                ...el,
                points: el.points.map((p) => ({ x: p.x, y: p.y + dy })),
              };
            }
            return { ...el, x: el.x, y: el.y + dy };
          }),
        }));
      }
    },
    [present.elements, selectedIds, setHistory]
  );

  const addConnection = useCallback(
    (fromId: string, toId: string) => {
      setHistory((prev) => {
        if (prev.connections.some((c) => c.fromId === fromId && c.toId === toId))
          return prev;
        return {
          ...prev,
          connections: [...prev.connections, { id: uid(), fromId, toId }],
        };
      });
    },
    [setHistory]
  );

  const removeConnection = useCallback(
    (id: string) => {
      setHistory((prev) => ({
        ...prev,
        connections: prev.connections.filter((c) => c.id !== id),
      }));
    },
    [setHistory]
  );

  const updateNodeProperties = useCallback(
    (id: string, properties: Record<string, string>) => {
      setHistory((prev) => ({
        ...prev,
        elements: prev.elements.map((el) =>
          el.id === id && el.nodeData
            ? { ...el, nodeData: { ...el.nodeData, properties } }
            : el
        ),
      }));
    },
    [setHistory]
  );

  const updateNodeStatus = useCallback(
    (id: string, status: NodeStatus, outputUrl?: string, error?: string, outputUrls?: string[]) => {
      setHistory((prev) => ({
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
    [setHistory]
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
      addElements,
      updateElement,
      removeElements,
      selectElements,
      toggleSelection,
      clearSelection,
      moveElements,
      renameElement,
      setCamera,
      replaceWorkflow,
      bringToFront,
      sendToBack,
      addConnection,
      removeConnection,
      updateNodeProperties,
      updateNodeStatus,
      copyToClipboard,
      duplicateSelection,
      selectAll,
      alignSelection,
      distributeSelection,
      undo: undo,
      redo: redo,
      canUndo: canUndo,
      canRedo: canRedo,
      runWorkflow,
      setRunWorkflow: (fn) => setRunWorkflowState(() => fn),
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
      addElements,
      updateElement,
      removeElements,
      selectElements,
      toggleSelection,
      clearSelection,
      moveElements,
      renameElement,
      setCamera,
      replaceWorkflow,
      bringToFront,
      sendToBack,
      addConnection,
      removeConnection,
      updateNodeProperties,
      updateNodeStatus,
      copyToClipboard,
      duplicateSelection,
      selectAll,
      alignSelection,
      distributeSelection,
      toggleSnapToGrid,
      toggleShowGrid,
      undo,
      redo,
      canUndo,
      canRedo,
      runWorkflow,
      setRunWorkflowState,
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
