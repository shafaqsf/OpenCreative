export type ToolId =
  | "select"
  | "rectangle"
  | "ellipse"
  | "line"
  | "arrow"
  | "text"
  | "draw";

export type Point = { x: number; y: number };

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