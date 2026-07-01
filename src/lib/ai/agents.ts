import { openrouter } from "./openrouter";
import type { AgentAction, AgentAppState, AgentMessage, AgentResponse } from "@/types/agent";

const SYSTEM_PROMPT = `You are OpenCreative Agent, an action-capable operator inside a canvas-based AI workflow builder.

You do not behave like a generic chatbot. You inspect the provided app state and choose tool calls that directly change the workspace when helpful.

Available concepts:
- The canvas contains annotation elements (shapes, text, drawings) and executable workflow nodes.
- Workflow nodes are prompt, source, and generate. NEVER create output nodes yourself — they are created automatically when the Generate node runs a workflow.
- Prompt text belongs in prompt node content. Do not put prompt text on generate node properties.
- Generate nodes should contain model/output settings and should receive instructions through connected prompt nodes.
- Users can create nodes, move nodes, connect nodes, update node properties, create annotations, set camera view, run workflows, select tools, and rename/delete/duplicate selected items.
- Prefer concrete actions over long explanations.
- When creating a workflow, produce a clean left-to-right node graph.
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
                type: { type: "string", enum: ["prompt", "source", "generate"] },
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
      name: "move_nodes",
      description: "Move existing workflow nodes or annotations to new coordinates.",
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
                id: { type: "string" },
                x: { type: "number" },
                y: { type: "number" },
              },
              required: ["id", "x", "y"],
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
      name: "connect_nodes",
      description: "Connect existing nodes by their IDs.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          connections: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                fromId: { type: "string" },
                toId: { type: "string" },
              },
              required: ["fromId", "toId"],
            },
          },
        },
        required: ["connections"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_node_properties",
      description: "Update properties of an existing node by ID.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          properties: { type: "object", additionalProperties: { type: "string" } },
        },
        required: ["id", "properties"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_camera",
      description: "Set the canvas camera position and zoom.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          x: { type: "number" },
          y: { type: "number" },
          zoom: { type: "number" },
        },
        required: ["x", "y", "zoom"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_annotations",
      description: "Create annotation shapes or text on the canvas.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          annotations: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                type: {
                  type: "string",
                  enum: [
                    "rectangle",
                    "ellipse",
                    "triangle",
                    "diamond",
                    "star",
                    "line",
                    "arrow",
                    "text",
                    "draw",
                  ],
                },
                x: { type: "number" },
                y: { type: "number" },
                width: { type: "number" },
                height: { type: "number" },
                text: { type: "string" },
              },
              required: ["type", "x", "y"],
            },
          },
        },
        required: ["annotations"],
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
          return [
            {
              type: "create_nodes" as const,
              nodes: args.nodes ?? [],
              connections: args.connections ?? [],
            },
          ];
        case "move_nodes":
          return [{ type: "move_nodes" as const, nodes: args.nodes ?? [] }];
        case "connect_nodes":
          return [{ type: "connect_nodes" as const, connections: args.connections ?? [] }];
        case "update_node_properties":
          return [
            {
              type: "update_node_properties" as const,
              id: args.id ?? "",
              properties: args.properties ?? {},
            },
          ];
        case "set_camera":
          return [
            {
              type: "set_camera" as const,
              x: args.x ?? 0,
              y: args.y ?? 0,
              zoom: args.zoom ?? 1,
            },
          ];
        case "create_annotations":
          return [
            {
              type: "create_annotations" as const,
              annotations: args.annotations ?? [],
            },
          ];
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
    },
  });
  const create = response.actions.find((action) => action.type === "create_nodes");
  return create && create.type === "create_nodes"
    ? { nodes: create.nodes, connections: create.connections ?? [] }
    : { nodes: [], connections: [] };
}
