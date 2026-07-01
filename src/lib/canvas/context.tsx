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

type CanvasContextValue = {
  elements: CanvasElement[];
  selectedIds: string[];
  activeTool: ToolId;
  camera: Camera;
  connections: Connection[];

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
  const [elements, setElements] = useState<CanvasElement[]>(
    initialState.elements
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<ToolId>("select");
  const [camera, setCameraState] = useState<Camera>(initialState.camera);
  const [connections, setConnections] = useState<Connection[]>(
    initialState.connections
  );
  const [mounted, setMounted] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

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
    const idSet = new Set(ids);
    setElements((prev) => prev.filter((el) => !idSet.has(el.id)));
    setSelectedIds((prev) => prev.filter((id) => !idSet.has(id)));
    setConnections((prev) =>
      prev.filter((c) => !idSet.has(c.fromId) && !idSet.has(c.toId))
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

  const moveElements = useCallback(
    (ids: string[], dx: number, dy: number) => {
      setElements((prev) =>
        prev.map((el) => {
          if (!ids.includes(el.id)) return el;
          if (el.points) {
            return {
              ...el,
              points: el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
            };
          }
          return { ...el, x: el.x + dx, y: el.y + dy };
        })
      );
    },
    []
  );

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

  const addConnection = useCallback((fromId: string, toId: string) => {
    setConnections((prev) => {
      if (prev.some((c) => c.fromId === fromId && c.toId === toId))
        return prev;
      return [...prev, { id: uid(), fromId, toId }];
    });
  }, []);

  const removeConnection = useCallback((id: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const updateNodeProperties = useCallback(
    (id: string, properties: Record<string, string>) => {
      setElements((prev) =>
        prev.map((el) =>
          el.id === id && el.nodeData
            ? { ...el, nodeData: { ...el.nodeData, properties } }
            : el
        )
      );
    },
    []
  );

  const updateNodeStatus = useCallback(
    (id: string, status: NodeStatus, outputUrl?: string, error?: string, outputUrls?: string[]) => {
      setElements((prev) =>
        prev.map((el) =>
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
        )
      );
    },
    []
  );

  const value = useMemo<CanvasContextValue>(
    () => ({
      elements,
      selectedIds,
      activeTool,
      camera,
      connections,
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
      addConnection,
      removeConnection,
      updateNodeProperties,
      updateNodeStatus,
    }),
    [
      elements,
      selectedIds,
      activeTool,
      camera,
      connections,
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
      addConnection,
      removeConnection,
      updateNodeProperties,
      updateNodeStatus,
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