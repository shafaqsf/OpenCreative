import type { CanvasElement, NodeData, NodeStatus, WorkflowState } from "@/types/canvas";
import { normalizeOutputVersions } from "@/lib/canvas/output-versions";

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
  const normalized =
    nodeData.nodeType === "output" || nodeData.nodeType === "generate"
      ? normalizeOutputVersions(nodeData)
      : nodeData;
  const outputUrls = normalized.outputUrls?.filter(Boolean);
  const outputUrl = normalized.outputUrl || outputUrls?.[0];

  return {
    ...normalized,
    status: getDurableStatus(normalized, outputUrl, outputUrls),
    outputUrl,
    outputUrls: outputUrls && outputUrls.length > 0 ? outputUrls : undefined,
    error: undefined,
    properties: { ...normalized.properties },
    outputVersions: normalized.outputVersions?.map((version) => ({ ...version, editMetadata: version.editMetadata ? { ...version.editMetadata } : undefined })),
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
