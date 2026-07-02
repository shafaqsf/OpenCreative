import { getGenerationModel } from "./generation-models";
import { getFinalOrActiveOutputVersion, normalizeOutputVersions } from "./output-versions";
import type { CanvasElement, Connection, NodeType } from "@/types/canvas";

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
  freshOutputIds: Record<string, string[]>;
  issues: string[];
};

const ALLOWED_CONNECTIONS: Record<NodeType, NodeType[]> = {
  prompt: ["generate"],
  source: ["generate"],
  generate: ["generate", "output"],
  output: ["generate"],
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

export function normalizeConnectionDirection(
  elements: CanvasElement[],
  fromId: string,
  toId: string
): { fromId: string; toId: string } {
  const from = elements.find((element) => element.id === fromId);
  const to = elements.find((element) => element.id === toId);

  if (
    isWorkflowNode(from) &&
    isWorkflowNode(to) &&
    from.nodeData.nodeType === "output" &&
    to.nodeData.nodeType === "generate" &&
    !hasOutputMedia(from)
  ) {
    return { fromId: to.id, toId: from.id };
  }

  return { fromId, toId };
}

function hasOutputMedia(element: WorkflowNodeElement) {
  return Boolean(
    element.nodeData.outputUrl ||
      element.nodeData.outputUrls?.length ||
      element.nodeData.outputVersions?.length
  );
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
        outputVersions: undefined,
        activeOutputVersionId: undefined,
        finalOutputVersionId: undefined,
        error: undefined,
      };
      continue;
    }
    if (nodeType === "output") {
      node.nodeData = normalizeOutputVersions({
        ...node.nodeData,
        error: undefined,
      }, node.id);
    }
  }

  const freshOutputIds: Record<string, string[]> = {};

  for (const generate of nextElements) {
    if (!isWorkflowNode(generate) || generate.nodeData.nodeType !== "generate") continue;

    const model = getGenerationModel(generate.nodeData.properties.model);
    generate.nodeData.properties = {
      ...generate.nodeData.properties,
      model: model.id,
      outputType: model.outputType,
    };
  }

  for (const generate of nextElements) {
    if (!isWorkflowNode(generate) || generate.nodeData.nodeType !== "generate") continue;

    const model = getGenerationModel(generate.nodeData.properties.model);
    normalizeEmptyOutputTargetConnections(nextElements, nextConnections, generate.id);
    const connectedOutputs = getConnectedOutputIds(nextElements, nextConnections, generate.id);

    connectedOutputs.forEach((outputId, index) => {
      const output = nextElements.find((element) => element.id === outputId);
      if (!isWorkflowNode(output)) return;
      output.nodeData = {
        ...output.nodeData,
        status: "idle",
        error: undefined,
        properties: {
          ...output.nodeData.properties,
          outputIndex: String(index),
          outputType: model.outputType,
        },
      };
    });

    freshOutputIds[generate.id] = connectedOutputs;
  }

  const generateIds = sortGenerateNodes(nextElements, nextConnections, issues);
  return {
    elements: nextElements,
    connections: nextConnections,
    addedElements,
    addedConnections,
    generateIds,
    freshOutputIds,
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
      const url = getSelectedOutputUrl(element.nodeData)?.trim();
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

export function getGenerateRunIssue(
  elements: CanvasElement[],
  connections: Connection[],
  generateId: string
): string | undefined {
  if (getConnectedOutputIds(elements, connections, generateId).length === 0) {
    return "Connect an Output node.";
  }

  const input = collectGenerateInput(elements, connections, generateId);
  if (!input.prompt && !input.mediaUrl) {
    const upstreamNodes = getGenerateInputNodes(elements, connections, generateId);
    const hasPrompt = upstreamNodes.some((node) => node.nodeData.nodeType === "prompt");
    const hasSource = upstreamNodes.some((node) => node.nodeData.nodeType === "source");
    const hasMediaOutput = upstreamNodes.some((node) =>
      node.nodeData.nodeType === "generate" || node.nodeData.nodeType === "output"
    );

    if (hasPrompt && !hasSource && !hasMediaOutput) {
      return "Add prompt text.";
    }

    if (hasSource && !hasPrompt && !hasMediaOutput) {
      return "Upload or paste media.";
    }

    if (hasMediaOutput && !hasPrompt && !hasSource) {
      return "Select generated media.";
    }

    if (upstreamNodes.length > 0) {
      return "Add prompt text, upload media, or select generated media.";
    }

    return "Connect a Prompt, Source, or Output node.";
  }

  return undefined;
}

function getGenerateInputNodes(
  elements: CanvasElement[],
  connections: Connection[],
  generateId: string
) {
  const upstreamIds = collectUpstreamIds(connections, generateId);
  return elements.filter(
    (element): element is WorkflowNodeElement =>
      upstreamIds.has(element.id) && isWorkflowNode(element)
  );
}

export function getConnectedOutputIds(
  elements: CanvasElement[],
  connections: Connection[],
  generateId: string
): string[] {
  const directOutputIds = connections
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

  const reversedEmptyOutputIds = connections
    .filter((connection) => connection.toId === generateId)
    .map((connection) => elements.find((element) => element.id === connection.fromId))
    .filter(
      (element): element is WorkflowNodeElement =>
        isWorkflowNode(element) &&
        element.nodeData.nodeType === "output" &&
        !hasOutputMedia(element)
    )
    .map((element) => element.id);

  return Array.from(new Set([...directOutputIds, ...reversedEmptyOutputIds]));
}

function normalizeEmptyOutputTargetConnections(
  elements: CanvasElement[],
  connections: Connection[],
  generateId: string
) {
  connections.forEach((connection) => {
    if (connection.toId !== generateId) return;
    const from = elements.find((element) => element.id === connection.fromId);
    const to = elements.find((element) => element.id === connection.toId);
    if (
      isWorkflowNode(from) &&
      isWorkflowNode(to) &&
      from.nodeData.nodeType === "output" &&
      to.nodeData.nodeType === "generate" &&
      !hasOutputMedia(from)
    ) {
      connection.fromId = generateId;
      connection.toId = from.id;
    }
  });
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
          outputVersions: element.nodeData.outputVersions
            ? element.nodeData.outputVersions.map((version) => ({
                ...version,
                editMetadata: version.editMetadata ? { ...version.editMetadata } : undefined,
              }))
            : undefined,
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

function getSelectedOutputUrl(nodeData: WorkflowNodeElement["nodeData"]) {
  const version = getFinalOrActiveOutputVersion(nodeData);
  if (version) return version.url;

  if (!nodeData.outputUrls || nodeData.outputUrls.length === 0) {
    return nodeData.outputUrl;
  }

  const selectedIndex = Number.parseInt(nodeData.properties.selectedOutputIndex ?? "0", 10);
  return nodeData.outputUrls[selectedIndex] ?? nodeData.outputUrl ?? nodeData.outputUrls[0];
}
