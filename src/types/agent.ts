import type { NodeType, ToolId, WorkflowState } from "./canvas";

export type AgentRole = "user" | "assistant";

export type AgentMessage = {
  id: string;
  role: AgentRole;
  content: string;
  createdAt: string;
  checkpointId?: string;
};

export type AgentCheckpointUI = {
  id: string;
  chatId: string;
  messageId: string;
  label: string;
  createdAt: string;
};

export type AgentAppState = {
  projectName: string;
  workflow: WorkflowState;
  selectedIds: string[];
  activeTool: ToolId;
};

type AgentNodeType = Exclude<NodeType, "output">;
type AnnotationType = Exclude<ToolId, "select" | "prompt" | "source" | "generate" | "output">;

export type AgentAction =
  | {
      type: "create_nodes";
      nodes: {
        type: AgentNodeType;
        x: number;
        y: number;
        properties?: Record<string, string>;
      }[];
      connections?: { from: number; to: number }[];
    }
  | {
      type: "move_nodes";
      nodes: { id: string; x: number; y: number }[];
    }
  | {
      type: "connect_nodes";
      connections: { fromId: string; toId: string }[];
    }
  | {
      type: "update_node_properties";
      id: string;
      properties: Record<string, string>;
    }
  | {
      type: "set_camera";
      x: number;
      y: number;
      zoom: number;
    }
  | {
      type: "create_annotations";
      annotations: {
        type: AnnotationType;
        x: number;
        y: number;
        width?: number;
        height?: number;
        text?: string;
      }[];
    }
  | { type: "run_workflow" }
  | { type: "select_tool"; tool: ToolId }
  | { type: "delete_selection" }
  | { type: "duplicate_selection" }
  | { type: "rename_selection"; name: string };

export type AgentResponse = {
  message: string;
  actions: AgentAction[];
};
