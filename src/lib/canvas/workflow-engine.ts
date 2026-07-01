import { getGenerationModel, normalizeOutputCount } from "./generation-models";
import type { CanvasElement, Connection, NodeType } from "@/types/canvas";
import { NODE_CONFIG } from "@/types/canvas";

export type WorkflowNodeElement = CanvasElement & {
  type: NodeType;
  nodeData: NonNullable<CanvasElement["nodeData"]>;
};

export type WorkflowInput = {
  prompt: string;
  mediaUrl?: string;
  sourceUrl?: string;
};

export type PreparedWorkflow = {
  elements: CanvasElement[];
  connections: Connection[];
  addedElements: CanvasElement[];
  addedConnections: Connection[];
  generateIds: string[];
  issues: string[];
};

const ALLOWED_CONNECTIONS: Record<NodeType, NodeType[]> = {
  prompt: ["generate"],
  source: ["generate"],
  generate: ["generate", "output"],
  output: [],
};

export function isWorkflowNode(element: CanvasElement | undefined): element is WorkflowNodeElement {
  return Boolean(element?.nodeData);
}

export function canConnectNodes(
  elements: CanvasElement[],
  connections: Connection[],
  fromId: string,
  toId: string
): { ok: boolean; reason?: string } {
  if (fromId === toId) return { ok: false, reason: "A node cannot connect to itself." };

  const from = elements.find((element) => element.id === fromId);
  const to = elements.find((element) => element.id === toId);
  if (!isWorkflowNode(from) || !isWorkflowNode(to)) {
    return { ok: false, reason: "Connections can only be made between workflow nodes." };
  }

  const allowedTargets = ALLOWED_CONNECTIONS[from.nodeData.nodeType] ?? [];
  if (!allowedTargets.includes(to.nodeData.nodeType)) {
    return {
      ok: false,
      reason: `${from.nodeData.label} nodes cannot feed ${to.nodeData.label} nodes.`,
    };
  }

  if (connections.some((connection) => connection.fromId === fromId && connection.toId === toId)) {
    return { ok: false, reason: "That connection already exists." };
  }

  if (wouldCreateCycle(connections, fromId, toId)) {
    return { ok: false, reason: "That connection would create a cycle." };
  }

  return { ok: true };
}

export function prepareWorkflowRun(
  elements: CanvasElement[],
  connections: Connection[]
): PreparedWorkflow {
  const nextElements = cloneElementsForRun(elements);
  const nextConnections = connections.map((connection) => ({ ...connection }));
  const addedElements: CanvasElement[] = [];
  const addedConnections: Connection[] = [];
  const issues: string[] = [];

  for (const node of nextElements) {
    if (!isWorkflowNode(node)) continue;
    const nodeType = node.nodeData.nodeType;
    if (nodeType === "prompt") {
      node.nodeData = {
        ...node.nodeData,
        status: "done",
        outputUrl: undefined,
        error: undefined,
      };
      continue;
    }
    if (nodeType === "source") {
      const url = node.nodeData.properties.url?.trim();
      node.nodeData = {
        ...node.nodeData,
        status: url ? "done" : "idle",
        outputUrl: url || undefined,
        error: undefined,
      };
      continue;
    }
    if (nodeType === "generate") {
      node.nodeData = {
        ...node.nodeData,
        status: "idle",
        outputUrl: undefined,
        outputUrls: undefined,
        error: undefined,
      };
    }
  }

  for (const generate of nextElements) {
    if (!isWorkflowNode(generate) || generate.nodeData.nodeType !== "generate") continue;

    const model = getGenerationModel(generate.nodeData.properties.model);
    const count = normalizeOutputCount(generate.nodeData.properties.count, model.id);
    generate.nodeData.properties = {
      ...generate.nodeData.properties,
      model: model.id,
      outputType: model.outputType,
      count: String(count),
    };

    const existingOutputIds = nextConnections
      .filter((conn) => conn.fromId === generate.id)
      .map((conn) => nextElements.find((el) => el.id === conn.toId))
      .filter(
        (el): el is WorkflowNodeElement =>
          isWorkflowNode(el) && el.nodeData.nodeType === "output"
      )
      .map((el) => el.id);

    while (existingOutputIds.length < count) {
      const created = createNode(
        "output",
        generate.x + Math.max(generate.width, 200) + 64,
        generate.y + existingOutputIds.length * 120
      );
      created.nodeData!.properties = {
        ...created.nodeData!.properties,
        outputType: model.outputType,
      };
      const conn = { id: uid(), fromId: generate.id, toId: created.id };
      nextElements.push(created);
      nextConnections.push(conn);
      addedElements.push(created);
      addedConnections.push(conn);
      existingOutputIds.push(created.id);
    }

    for (const outputId of existingOutputIds) {
      const output = nextElements.find((el) => el.id === outputId);
      if (isWorkflowNode(output)) {
        output.nodeData.properties = {
          ...output.nodeData.properties,
          outputType: model.outputType,
        };
      }
    }
  }

  const generateIds = sortGenerateNodes(nextElements, nextConnections, issues);
  return {
    elements: nextElements,
    connections: nextConnections,
    addedElements,
    addedConnections,
    generateIds,
    issues,
  };
}

export function collectGenerateInput(
  elements: CanvasElement[],
  connections: Connection[],
  generateId: string
): WorkflowInput {
  const upstreamIds = collectUpstreamIds(connections, generateId);
  const prompts: string[] = [];
  const mediaUrls: string[] = [];

  for (const element of elements) {
    if (!upstreamIds.has(element.id) || !isWorkflowNode(element)) continue;
    const nodeType = element.nodeData.nodeType;
    if (nodeType === "prompt") {
      const content = element.nodeData.properties.content?.trim();
      if (content) prompts.push(content);
    }
    if (nodeType === "source") {
      const url = element.nodeData.properties.url?.trim();
      if (url) mediaUrls.push(url);
    }
    if (nodeType === "generate" || nodeType === "output") {
      const url = element.nodeData.outputUrl?.trim();
      if (url) mediaUrls.push(url);
    }
  }

  const directPrompt = getNode(elements, generateId)?.nodeData.properties.prompt?.trim();
  if (directPrompt) prompts.push(directPrompt);

  return {
    prompt: dedupe(prompts).join("\n\n"),
    mediaUrl: dedupe(mediaUrls).find(Boolean),
    sourceUrl: dedupe(mediaUrls).find(Boolean),
  };
}

export function getConnectedOutputIds(
  elements: CanvasElement[],
  connections: Connection[],
  generateId: string
): string[] {
  return connections
    .filter((connection) => connection.fromId === generateId)
    .map((connection) => elements.find((element) => element.id === connection.toId))
    .filter(
      (element): element is WorkflowNodeElement =>
        isWorkflowNode(element) && element.nodeData.nodeType === "output"
    )
    .sort((a, b) => {
      const aIndex = Number.parseInt(a.nodeData.properties.outputIndex ?? "0", 10);
      const bIndex = Number.parseInt(b.nodeData.properties.outputIndex ?? "0", 10);
      return aIndex - bIndex;
    })
    .map((element) => element.id);
}

export function getNode(elements: CanvasElement[], id: string): WorkflowNodeElement | undefined {
  const element = elements.find((item) => item.id === id);
  return isWorkflowNode(element) ? element : undefined;
}

function cloneElementsForRun(elements: CanvasElement[]): CanvasElement[] {
  return elements.map((element): CanvasElement => ({
    ...element,
    points: element.points?.map((point) => ({ ...point })),
    nodeData: element.nodeData
      ? {
          ...element.nodeData,
          properties: { ...element.nodeData.properties },
          outputUrls: element.nodeData.outputUrls ? [...element.nodeData.outputUrls] : undefined,
        }
      : undefined,
  }));
}

function collectUpstreamIds(connections: Connection[], nodeId: string) {
  const upstream = new Set<string>();
  const queue = connections
    .filter((connection) => connection.toId === nodeId)
    .map((connection) => connection.fromId);

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (upstream.has(id)) continue;
    upstream.add(id);
    for (const parent of connections.filter((connection) => connection.toId === id)) {
      queue.push(parent.fromId);
    }
  }

  return upstream;
}

function sortGenerateNodes(
  elements: CanvasElement[],
  connections: Connection[],
  issues: string[]
): string[] {
  const generateIds = elements
    .filter((element) => isWorkflowNode(element) && element.nodeData.nodeType === "generate")
    .map((element) => element.id);
  const generateSet = new Set(generateIds);
  const sorted: string[] = [];
  const temporary = new Set<string>();
  const permanent = new Set<string>();

  const visit = (id: string) => {
    if (permanent.has(id)) return;
    if (temporary.has(id)) {
      issues.push("Workflow contains a cycle. Remove the loop before running.");
      return;
    }
    temporary.add(id);
    const parents = connections
      .filter((connection) => connection.toId === id && generateSet.has(connection.fromId))
      .map((connection) => connection.fromId);
    parents.forEach(visit);
    temporary.delete(id);
    permanent.add(id);
    sorted.push(id);
  };

  generateIds.forEach(visit);
  return sorted;
}

function wouldCreateCycle(connections: Connection[], fromId: string, toId: string) {
  const queue = [toId];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (id === fromId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const connection of connections) {
      if (connection.fromId === id) queue.push(connection.toId);
    }
  }
  return false;
}

function dedupe(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function createNode(nodeType: NodeType, x: number, y: number): CanvasElement {
  const config = NODE_CONFIG[nodeType];
  return {
    id: uid(),
    type: nodeType,
    x,
    y,
    width: config.w,
    height: config.h,
    stroke: "#171717",
    fill: "#ffffff",
    strokeWidth: 1.5,
    nodeData: {
      nodeType,
      label: config.label,
      properties: { ...config.defaultProps },
      status: "idle",
    },
  };
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
