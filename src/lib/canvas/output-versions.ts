import type {
  NodeData,
  OutputEditMetadata,
  OutputMediaType,
  OutputOperationType,
  OutputReviewState,
  OutputVersion,
} from "@/types/canvas";

export function outputVersionId() {
  return `ov_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function normalizeOutputVersions(nodeData: NodeData, sourceNodeId?: string): NodeData {
  const outputUrls = getFlatOutputUrls(nodeData);
  const existing = nodeData.outputVersions?.filter((version) => version.url) ?? [];
  const versions = [...existing];
  const seenUrls = new Set(versions.map((version) => version.url));
  const mediaType = getNodeOutputType(nodeData);

  outputUrls.forEach((url, index) => {
    if (seenUrls.has(url)) return;
    versions.push({
      id: `legacy-${index}-${hashString(url)}`,
      url,
      mediaType,
      sourceNodeId,
      operationType: "generated",
      approvalState: "none",
      createdAt: new Date().toISOString(),
    });
    seenUrls.add(url);
  });

  if (versions.length === 0) {
    return {
      ...nodeData,
      outputVersions: undefined,
      activeOutputVersionId: undefined,
      finalOutputVersionId: undefined,
      outputUrl: undefined,
      outputUrls: undefined,
    };
  }

  const active =
    versions.find((version) => version.id === nodeData.activeOutputVersionId) ??
    versions[getSelectedOutputIndex(nodeData, versions.length)] ??
    versions[0];
  const finalVersion = versions.find(
    (version) => version.id === nodeData.finalOutputVersionId && version.approvalState === "final"
  );

  return {
    ...nodeData,
    status: nodeData.status === "idle" ? "done" : nodeData.status,
    outputUrl: active.url,
    outputUrls: versions.map((version) => version.url),
    outputVersions: versions,
    activeOutputVersionId: active.id,
    finalOutputVersionId: finalVersion?.id ?? nodeData.finalOutputVersionId,
    properties: {
      ...nodeData.properties,
      selectedOutputIndex: String(Math.max(0, versions.findIndex((version) => version.id === active.id))),
      outputType: active.mediaType,
    },
  };
}

export function getOutputVersions(nodeData: NodeData, sourceNodeId?: string) {
  return normalizeOutputVersions(nodeData, sourceNodeId).outputVersions ?? [];
}

export function getActiveOutputVersion(nodeData: NodeData, sourceNodeId?: string) {
  const normalized = normalizeOutputVersions(nodeData, sourceNodeId);
  return (
    normalized.outputVersions?.find((version) => version.id === normalized.activeOutputVersionId) ??
    normalized.outputVersions?.[0]
  );
}

export function getFinalOrActiveOutputVersion(nodeData: NodeData, sourceNodeId?: string) {
  const normalized = normalizeOutputVersions(nodeData, sourceNodeId);
  return (
    normalized.outputVersions?.find((version) => version.id === normalized.finalOutputVersionId) ??
    getActiveOutputVersion(normalized, sourceNodeId)
  );
}

export function appendOutputVersion(
  nodeData: NodeData,
  input: {
    url: string;
    mediaType?: OutputMediaType;
    parentVersionId?: string;
    sourceNodeId?: string;
    operationType: OutputOperationType;
    promptDelta?: string;
    approvalState?: OutputReviewState;
    editMetadata?: OutputEditMetadata;
  }
): NodeData {
  const normalized = normalizeOutputVersions(nodeData, input.sourceNodeId);
  const versions = normalized.outputVersions ?? [];
  const version: OutputVersion = {
    id: outputVersionId(),
    url: input.url,
    mediaType: input.mediaType ?? getNodeOutputType(normalized),
    parentVersionId: input.parentVersionId,
    sourceNodeId: input.sourceNodeId,
    operationType: input.operationType,
    promptDelta: input.promptDelta,
    approvalState: input.approvalState ?? "none",
    createdAt: new Date().toISOString(),
    editMetadata: input.editMetadata,
  };
  const nextVersions = [...versions, version];

  return {
    ...normalized,
    status: "done",
    outputUrl: version.url,
    outputUrls: nextVersions.map((item) => item.url),
    outputVersions: nextVersions,
    activeOutputVersionId: version.id,
    properties: {
      ...normalized.properties,
      selectedOutputIndex: String(nextVersions.length - 1),
      outputType: version.mediaType,
    },
  };
}

export function selectOutputVersion(nodeData: NodeData, versionId: string): NodeData {
  const normalized = normalizeOutputVersions(nodeData);
  const versions = normalized.outputVersions ?? [];
  const selected = versions.find((version) => version.id === versionId) ?? versions[0];
  if (!selected) return normalized;

  return {
    ...normalized,
    outputUrl: selected.url,
    activeOutputVersionId: selected.id,
    properties: {
      ...normalized.properties,
      selectedOutputIndex: String(Math.max(0, versions.findIndex((version) => version.id === selected.id))),
      outputType: selected.mediaType,
    },
  };
}

export function removeOutputVersion(nodeData: NodeData, versionId: string): NodeData {
  const normalized = normalizeOutputVersions(nodeData);
  const versions = (normalized.outputVersions ?? []).filter((version) => version.id !== versionId);
  if (versions.length === 0) {
    return {
      ...normalized,
      status: "idle",
      outputUrl: undefined,
      outputUrls: undefined,
      outputVersions: undefined,
      activeOutputVersionId: undefined,
      finalOutputVersionId: undefined,
      properties: {
        ...normalized.properties,
        selectedOutputIndex: "0",
      },
    };
  }

  const nextActive =
    versions.find((version) => version.id === normalized.activeOutputVersionId) ??
    versions[versions.length - 1];

  return {
    ...normalized,
    outputUrl: nextActive.url,
    outputUrls: versions.map((version) => version.url),
    outputVersions: versions,
    activeOutputVersionId: nextActive.id,
    finalOutputVersionId:
      normalized.finalOutputVersionId === versionId ? undefined : normalized.finalOutputVersionId,
    properties: {
      ...normalized.properties,
      selectedOutputIndex: String(versions.findIndex((version) => version.id === nextActive.id)),
      outputType: nextActive.mediaType,
    },
  };
}

export function updateOutputVersionReview(
  nodeData: NodeData,
  versionId: string,
  approvalState: OutputReviewState
): NodeData {
  const normalized = normalizeOutputVersions(nodeData);
  const versions: OutputVersion[] = (normalized.outputVersions ?? []).map((version) => {
    if (approvalState === "final") {
      return {
        ...version,
        approvalState:
          version.id === versionId
            ? "final"
            : version.approvalState === "final"
              ? "approved"
              : version.approvalState,
      };
    }
    return version.id === versionId ? { ...version, approvalState } : version;
  });
  const selected = versions.find((version) => version.id === normalized.activeOutputVersionId) ?? versions[0];

  return {
    ...normalized,
    outputVersions: versions,
    outputUrl: selected?.url,
    outputUrls: versions.map((version) => version.url),
    finalOutputVersionId: approvalState === "final" ? versionId : normalized.finalOutputVersionId,
  };
}

export function getNodeOutputType(nodeData: NodeData): OutputMediaType {
  return nodeData.properties.outputType === "video" || nodeData.properties.fileType === "video" ? "video" : "image";
}

function getFlatOutputUrls(nodeData: NodeData) {
  return Array.from(new Set([...(nodeData.outputUrls ?? []), nodeData.outputUrl].filter(Boolean) as string[]));
}

function getSelectedOutputIndex(nodeData: NodeData, outputCount: number) {
  if (outputCount === 0) return 0;
  const parsed = Number.parseInt(nodeData.properties.selectedOutputIndex ?? "0", 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(parsed, 0), outputCount - 1);
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
