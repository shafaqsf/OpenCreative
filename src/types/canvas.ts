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
  | "node_prompt"
  | "node_image"
  | "node_video"
  | "node_upload"
  | "node_output";

export type Point = { x: number; y: number };

export type NodeType =
  | "node_prompt"
  | "node_image"
  | "node_video"
  | "node_upload"
  | "node_output";

export type NodeData = {
  label?: string;
  prompt?: string;
  url?: string;
  model?: string;
  status?: "idle" | "running" | "done" | "error";
};

export type CanvasElement = {
  id: string;
  type: Exclude<ToolId, "select">;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  points?: Point[];
  text?: string;
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

export const DEFAULT_STROKE = "#111111";
export const DEFAULT_FILL = "transparent";
export const DEFAULT_STROKE_WIDTH = 2;