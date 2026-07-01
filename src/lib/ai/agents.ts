import { openrouter } from "./openrouter";
import type { AgentAction, AgentAppState, AgentMessage, AgentResponse } from "@/types/agent";

const SYSTEM_PROMPT = `You are OpenCreative Agent, an action-capable operator inside a canvas-based AI workflow builder.

You do not behave like a generic chatbot. You inspect the provided app state and choose tool calls that directly change the workspace when helpful.

Available concepts:
- The canvas contains annotation elements and executable workflow nodes.
- Workflow nodes are prompt, source, generate, and output.
- Prompt text belongs in prompt node content. Do not put prompt text on generate node properties.
- Generate nodes should contain model/output settings and should receive instructions through connected prompt nodes.
- Users can create nodes, connect nodes, run workflows, select tools, rename/delete/duplicate selected items, and create or restore checkpoints.
- Prefer concrete actions over long explanations.
- When creating a workflow, produce a clean left-to-right node graph.
- Always create a checkpoint before destructive or large workspace-changing actions.
- If the user asks a question only, answer without tool calls.
- Keep the final message concise and describe what you did or what is needed next.`;

const tools = [
  {
    type: "function" as const,
    function: {
      name: "create_nodes",
      description: "Create workflow nodes on the canvas and optionally connect them.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          nodes: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                type: { type: "string", enum: ["prompt", "source", "generate", "output"] },
                x: { type: "number" },
                y: { type: "number" },
                properties: { type: "object", additionalProperties: { type: "string" } },
              },
              required: ["type", "x", "y"],
            },
          },
          connections: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                from: { type: "number" },
                to: { type: "number" },
              },
              required: ["from", "to"],
            },
          },
        },
        required: ["nodes"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "run_workflow",
      description: "Run the current canvas workflow.",
      parameters: { type: "object", additionalProperties: false, properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "select_tool",
      description: "Switch the active canvas tool.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          tool: {
            type: "string",
            enum: [
              "select",
              "rectangle",
              "ellipse",
              "triangle",
              "diamond",
              "star",
              "line",
              "arrow",
              "text",
              "draw",
              "prompt",
              "source",
              "generate",
              "output",
            ],
          },
        },
        required: ["tool"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_selection",
      description: "Delete the currently selected canvas items.",
      parameters: { type: "object", additionalProperties: false, properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "duplicate_selection",
      description: "Duplicate the currently selected canvas items.",
      parameters: { type: "object", additionalProperties: false, properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "rename_selection",
      description: "Rename the selected layer or node.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_checkpoint",
      description: "Create a named checkpoint of the current canvas state.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "restore_checkpoint",
      description: "Restore a previous checkpoint by id.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: { checkpointId: { type: "string" } },
        required: ["checkpointId"],
      },
    },
  },
];

export async function runOpenCreativeAgent({
  input,
  messages,
  appState,
}: {
  input: string;
  messages: AgentMessage[];
  appState: AgentAppState;
}): Promise<AgentResponse> {
  const completion = await openrouter.chat.completions.create({
    model: "openai/gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "system",
        content: `Current app state:\n${JSON.stringify(summarizeAppState(appState), null, 2)}`,
      },
      ...messages.slice(-8).map((message) => ({
        role: message.role,
        content: message.content,
      })),
      { role: "user", content: input },
    ],
    tools,
    tool_choice: "auto",
    max_tokens: 1600,
  });

  const message = completion.choices[0]?.message;
  if (!message) throw new Error("No response from agent");

  const actions: AgentAction[] =
    message.tool_calls?.flatMap<AgentAction>((toolCall) => {
      if (toolCall.type !== "function") return [];
      const args = parseArgs(toolCall.function.arguments);
      switch (toolCall.function.name) {
        case "create_nodes":
          return [{ type: "create_nodes" as const, nodes: args.nodes ?? [], connections: args.connections ?? [] }];
        case "run_workflow":
          return [{ type: "run_workflow" as const }];
        case "select_tool":
          return [{ type: "select_tool" as const, tool: args.tool }];
        case "delete_selection":
          return [{ type: "delete_selection" as const }];
        case "duplicate_selection":
          return [{ type: "duplicate_selection" as const }];
        case "rename_selection":
          return [{ type: "rename_selection" as const, name: args.name ?? "Untitled" }];
        case "create_checkpoint":
          return [{ type: "create_checkpoint" as const, name: args.name ?? "Checkpoint" }];
        case "restore_checkpoint":
          return [{ type: "restore_checkpoint" as const, checkpointId: args.checkpointId ?? "" }];
        default:
          return [];
      }
    }) ?? [];

  return {
    message:
      typeof message.content === "string" && message.content.trim()
        ? message.content.trim()
        : actions.length > 0
          ? "I prepared the requested workspace action."
          : "I could not determine a safe action.",
    actions,
  };
}

function parseArgs(raw: string) {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

function summarizeAppState(appState: AgentAppState) {
  return {
    projectName: appState.projectName,
    selectedIds: appState.selectedIds,
    activeTool: appState.activeTool,
    elementCount: appState.workflow.elements.length,
    connectionCount: appState.workflow.connections.length,
    checkpoints: appState.checkpoints.map((checkpoint) => ({
      id: checkpoint.id,
      name: checkpoint.name,
      createdAt: checkpoint.createdAt,
    })),
    nodes: appState.workflow.elements
      .filter((element) => element.nodeData)
      .map((element) => ({
        id: element.id,
        type: element.type,
        label: element.customLabel ?? element.nodeData?.label,
        properties: element.nodeData?.properties,
        status: element.nodeData?.status,
      })),
  };
}

export async function generateWorkflowFromPrompt(prompt: string) {
  const response = await runOpenCreativeAgent({
    input: prompt,
    messages: [],
    appState: {
      projectName: "Untitled project",
      workflow: { elements: [], connections: [], camera: { x: 0, y: 0, zoom: 1 } },
      selectedIds: [],
      activeTool: "select",
      checkpoints: [],
    },
  });
  const create = response.actions.find((action) => action.type === "create_nodes");
  return create && create.type === "create_nodes"
    ? { nodes: create.nodes, connections: create.connections ?? [] }
    : { nodes: [], connections: [] };
}
