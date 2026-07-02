import type { CanvasElement, NodeData, NodeStatus, WorkflowState } from "@/types/canvas";

export function sanitizeWorkflowForPersistence(state: WorkflowState): WorkflowState {
  return {
    ...state,
    camera: { ...state.camera },
    connections: state.connections.map((connection) => ({ ...connection })),
    ui: state.ui ? { ...state.ui } : state.ui,
    elements: state.elements.map(sanitizeElementForPersistence),
  };
}

function sanitizeElementForPersistence(element: CanvasElement): CanvasElement {
  return {
    ...element,
    points: element.points?.map((point) => ({ ...point })),
    nodeData: element.nodeData ? sanitizeNodeDataForPersistence(element.nodeData) : undefined,
  };
}

function sanitizeNodeDataForPersistence(nodeData: NodeData): NodeData {
  const outputUrls = nodeData.outputUrls?.filter(Boolean);
  const outputUrl = nodeData.outputUrl || outputUrls?.[0];

  return {
    ...nodeData,
    status: getDurableStatus(nodeData, outputUrl, outputUrls),
    outputUrl,
    outputUrls: outputUrls && outputUrls.length > 0 ? outputUrls : undefined,
    error: undefined,
    properties: { ...nodeData.properties },
  };
}

function getDurableStatus(
  nodeData: NodeData,
  outputUrl: string | undefined,
  outputUrls: string[] | undefined
): NodeStatus {
  if (nodeData.nodeType === "source") {
    return nodeData.properties.url?.trim() ? "done" : "idle";
  }
  if (nodeData.nodeType === "output" || nodeData.nodeType === "generate") {
    return outputUrl || outputUrls?.length ? "done" : "idle";
  }
  return "idle";
}
