import { DEFAULT_GENERATION_MODEL } from "@/lib/canvas/generation-models";

export type ToolId =
  | "select"
  | "rectangle"
  | "ellipse"
  | "triangle"
  | "diamond"
  | "star"
  | "line"
  | "arrow"
  | "text"
  | "draw"
  | "prompt"
  | "source"
  | "generate"
  | "output";

export type Point = { x: number; y: number };

export type NodeType = "prompt" | "source" | "generate" | "output";

export type NodeStatus = "idle" | "running" | "done" | "error";

export type NodeData = {
  nodeType: NodeType;
  label: string;
  properties: Record<string, string>;
  status: NodeStatus;
  outputUrl?: string;
  outputUrls?: string[];
  error?: string;
};

export type Connection = {
  id: string;
  fromId: string;
  toId: string;
};

export type CanvasElement = {
  id: string;
  type: ToolId;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  points?: Point[];
  text?: string;
  customLabel?: string;
  nodeData?: NodeData;
  stroke: string;
  fill: string;
  strokeWidth: number;
};

export type Camera = {
  x: number;
  y: number;
  zoom: number;
};

export type WorkflowState = {
  elements: CanvasElement[];
  camera: Camera;
  connections: Connection[];
  ui?: {
    snapToGrid?: boolean;
    showGrid?: boolean;
  };
};

export const DEFAULT_STROKE = "#111111";
export const DEFAULT_FILL = "transparent";
export const DEFAULT_STROKE_WIDTH = 2;

export const NODE_CONFIG: Record<
  NodeType,
  { label: string; w: number; h: number; defaultProps: Record<string, string> }
> = {
  prompt: {
    label: "Prompt",
    w: 180,
    h: 80,
    defaultProps: { content: "" },
  },
  source: {
    label: "Source",
    w: 180,
    h: 130,
    defaultProps: { url: "", fileType: "image" },
  },
  generate: {
    label: "Generate",
    w: 200,
    h: 200,
    defaultProps: {
      model: DEFAULT_GENERATION_MODEL.id,
      outputType: DEFAULT_GENERATION_MODEL.outputType,
      duration: "5",
    },
  },
  output: {
    label: "Output",
    w: 200,
    h: 200,
    defaultProps: { outputIndex: "0", outputType: "image" },
  },
};

const NODE_TYPES = new Set<ToolId>(["prompt", "source", "generate", "output"]);

export function isNodeTool(tool: ToolId): tool is NodeType {
  return NODE_TYPES.has(tool);
}

export function isNodeElement(el: CanvasElement): el is CanvasElement & { nodeData: NodeData } {
  return isNodeTool(el.type) && !!el.nodeData;
}
