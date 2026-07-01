import type { NodeType, ToolId, WorkflowState } from "./canvas";

export type AgentRole = "user" | "assistant";

export type AgentMessage = {
  id: string;
  role: AgentRole;
  content: string;
  createdAt: string;
};

export type CanvasCheckpoint = {
  id: string;
  name: string;
  workflow: WorkflowState;
  createdAt: string;
};

export type AgentAppState = {
  projectName: string;
  workflow: WorkflowState;
  selectedIds: string[];
  activeTool: ToolId;
  checkpoints: CanvasCheckpoint[];
};

export type AgentAction =
  | {
      type: "create_nodes";
      nodes: {
        type: NodeType;
        x: number;
        y: number;
        properties?: Record<string, string>;
      }[];
      connections?: { from: number; to: number }[];
    }
  | { type: "run_workflow" }
  | { type: "select_tool"; tool: ToolId }
  | { type: "delete_selection" }
  | { type: "duplicate_selection" }
  | { type: "rename_selection"; name: string }
  | { type: "create_checkpoint"; name: string }
  | { type: "restore_checkpoint"; checkpointId: string };

export type AgentResponse = {
  message: string;
  actions: AgentAction[];
};
