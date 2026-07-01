import { uid, newNode } from "./context";
import { getGenerationModel } from "./generation-models";
import type { CanvasElement, Connection, NodeType } from "@/types/canvas";
import { getBounds } from "./hit-test";

export type Template = {
  id: string;
  name: string;
  description: string;
  elements: CanvasElement[];
  connections: Connection[];
  pinned?: boolean;
  updatedAt?: string;
};

const TEMPLATE_STORAGE_KEY = "opencreative:custom-templates";

export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: "text-to-image",
    name: "Text to image",
    description: "Prompt → Generate → Output",
    elements: [],
    connections: [],
  },
  {
    id: "image-to-video",
    name: "Image to video",
    description: "Source + Prompt → Generate → Output",
    elements: [],
    connections: [],
  },
  {
    id: "multi-variation",
    name: "Multi-variation",
    description: "Prompt → Generate → 4 outputs",
    elements: [],
    connections: [],
  },
];

function buildNode(
  type: NodeType,
  x: number,
  y: number,
  props: Record<string, string> = {}
): CanvasElement {
  const el = newNode(type, x, y);
  el.nodeData!.properties = { ...el.nodeData!.properties, ...props };
  return el;
}

function wire(from: CanvasElement, to: CanvasElement): Connection {
  return { id: uid(), fromId: from.id, toId: to.id };
}

function hydrateTemplates(): Template[] {
  const imageModel = getGenerationModel("google/gemini-3.1-flash-image");
  const videoModel = getGenerationModel("kwaivgi/kling-v3.0-pro");
  const prompt = buildNode("prompt", 80, 120, {
    content: "A cinematic scene based on the prompt",
  });
  const generate1 = buildNode("generate", 360, 120, {
    model: imageModel.id,
    outputType: imageModel.outputType,
  });

  const source = buildNode("source", 80, 320, { fileType: "image" });
  const prompt2 = buildNode("prompt", 80, 500, {
    content: "Animate this image into a video",
  });
  const generate2 = buildNode("generate", 360, 320, {
    model: videoModel.id,
    outputType: videoModel.outputType,
  });

  const prompt3 = buildNode("prompt", 80, 680, {
    content: "Four creative variations",
  });
  const generate3 = buildNode("generate", 360, 520, {
    model: imageModel.id,
    outputType: imageModel.outputType,
    count: "4",
  });

  return [
    {
      ...BUILTIN_TEMPLATES[0],
      elements: [prompt, generate1],
      connections: [wire(prompt, generate1)],
    },
    {
      ...BUILTIN_TEMPLATES[1],
      elements: [source, prompt2, generate2],
      connections: [wire(source, generate2), wire(prompt2, generate2)],
    },
    {
      ...BUILTIN_TEMPLATES[2],
      elements: [prompt3, generate3],
      connections: [wire(prompt3, generate3)],
    },
  ];
}

export function getBuiltInTemplates(): Template[] {
  return hydrateTemplates();
}

export function loadCustomTemplates(): Template[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeTemplate);
  } catch {
    return [];
  }
}

export function saveCustomTemplates(templates: Template[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates.map(normalizeTemplate)));
}

export function addCustomTemplate(template: Template) {
  const existing = loadCustomTemplates();
  saveCustomTemplates([...existing, template]);
}

export function normalizeTemplate(template: Template): Template {
  return {
    ...template,
    description: template.description || `${template.elements.length} item${template.elements.length === 1 ? "" : "s"}`,
    elements: Array.isArray(template.elements) ? template.elements : [],
    connections: Array.isArray(template.connections) ? template.connections : [],
    pinned: Boolean(template.pinned),
    updatedAt: template.updatedAt ?? new Date().toISOString(),
  };
}

export function sortTemplates(templates: Template[]): Template[] {
  return [...templates].sort((a, b) => {
    const pinDelta = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    if (pinDelta !== 0) return pinDelta;
    return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
  });
}

export function instantiateTemplate(
  template: Template,
  offset = { x: 32, y: 32 }
): { elements: CanvasElement[]; connections: Connection[] } {
  const idMap = new Map<string, string>();
  const elements = template.elements.map((el) => {
    const id = uid();
    idMap.set(el.id, id);
    return cloneElement(el, id, offset);
  });
  const connections = template.connections
    .map((conn) => {
      const fromId = idMap.get(conn.fromId);
      const toId = idMap.get(conn.toId);
      if (!fromId || !toId) return null;
      return { id: uid(), fromId, toId };
    })
    .filter((conn): conn is Connection => Boolean(conn));
  return { elements, connections };
}

export function instantiateTemplateAt(
  template: Template,
  anchor: { x: number; y: number }
): { elements: CanvasElement[]; connections: Connection[] } {
  const bounds = getTemplateBounds(template);
  const offset = {
    x: anchor.x - bounds.minX - bounds.w / 2,
    y: anchor.y - bounds.minY - bounds.h / 2,
  };
  return instantiateTemplate(template, offset);
}

export function snapshotTemplate(input: Template): Template {
  return normalizeTemplate({
    ...input,
    elements: input.elements.map((el) => cloneElement(el, el.id, { x: 0, y: 0 })),
    connections: input.connections.map((conn) => ({ ...conn })),
  });
}

function cloneElement(
  el: CanvasElement,
  id: string,
  offset: { x: number; y: number }
): CanvasElement {
  return {
    ...el,
    id,
    x: el.x + offset.x,
    y: el.y + offset.y,
    points: el.points?.map((point) => ({
      x: point.x + offset.x,
      y: point.y + offset.y,
    })),
    nodeData: el.nodeData
      ? {
          ...el.nodeData,
          properties: { ...el.nodeData.properties },
          outputUrl: undefined,
          outputUrls: undefined,
          error: undefined,
          status: "idle",
        }
      : undefined,
  };
}

function getTemplateBounds(template: Template) {
  if (template.elements.length === 0) {
    return { minX: 0, minY: 0, w: 0, h: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of template.elements) {
    const bounds = getBounds(el);
    minX = Math.min(minX, bounds.minX);
    minY = Math.min(minY, bounds.minY);
    maxX = Math.max(maxX, bounds.minX + bounds.w);
    maxY = Math.max(maxY, bounds.minY + bounds.h);
  }
  return { minX, minY, w: maxX - minX, h: maxY - minY };
}
