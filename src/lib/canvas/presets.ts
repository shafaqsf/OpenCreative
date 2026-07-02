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
    description: "Prompt → Generate → Output",
    elements: [],
    connections: [],
  },
  {
    id: "text-to-video",
    name: "Text to video",
    description: "Prompt → Generate video → Output",
    elements: [],
    connections: [],
  },
  {
    id: "image-to-image",
    name: "Image to image",
    description: "Source + Prompt → Generate image → Output",
    elements: [],
    connections: [],
  },
  {
    id: "dual-model",
    name: "Dual model",
    description: "Prompt → 2 models → side-by-side outputs",
    elements: [],
    connections: [],
  },
  {
    id: "animate-still",
    name: "Animate still",
    description: "Source → Generate video → Output",
    elements: [],
    connections: [],
  },
  {
    id: "prompt-chain",
    name: "Prompt chain",
    description: "Generate → Refine prompt → Generate again",
    elements: [],
    connections: [],
  },
  {
    id: "batch-premium",
    name: "Batch premium",
    description: "Prompt → Generate premium → Output",
    elements: [],
    connections: [],
  },
  {
    id: "style-transfer",
    name: "Style transfer",
    description: "Source + Style prompt → Generate → Output",
    elements: [],
    connections: [],
  },
  {
    id: "video-batch",
    name: "Video batch",
    description: "Source + Prompt → Generate video → Output",
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
  const premiumModel = getGenerationModel("google/gemini-3-pro-image");

  // --- Existing templates ---

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
  });

  // --- New templates ---

  // 4. Text to Video
  const ttvPrompt = buildNode("prompt", 80, 920, {
    content: "A cinematic drone shot of a futuristic city at sunset with neon lights",
  });
  const ttvGenerate = buildNode("generate", 360, 900, {
    model: videoModel.id,
    outputType: videoModel.outputType,
  });

  // 5. Image to Image
  const itiSource = buildNode("source", 80, 1180, { fileType: "image" });
  const itiPrompt = buildNode("prompt", 80, 1340, {
    content: "Transform this into a watercolor painting with soft edges",
  });
  const itiGenerate = buildNode("generate", 360, 1240, {
    model: imageModel.id,
    outputType: imageModel.outputType,
  });

  // 6. Dual Model
  const dmPrompt = buildNode("prompt", 80, 1680, {
    content: "A majestic lion in the savannah at golden hour",
  });
  const dmGenerate1 = buildNode("generate", 360, 1620, {
    model: imageModel.id,
    outputType: imageModel.outputType,
  });
  const dmGenerate2 = buildNode("generate", 640, 1620, {
    model: premiumModel.id,
    outputType: premiumModel.outputType,
  });

  // 7. Animate Still
  const asSource = buildNode("source", 80, 2020, { fileType: "image" });
  const asGenerate = buildNode("generate", 360, 2000, {
    model: videoModel.id,
    outputType: videoModel.outputType,
  });

  // 8. Prompt Chain
  const pcPrompt1 = buildNode("prompt", 80, 2320, {
    content: "A fantasy landscape with floating islands and waterfalls",
  });
  const pcGenerate1 = buildNode("generate", 360, 2300, {
    model: imageModel.id,
    outputType: imageModel.outputType,
  });
  const pcPrompt2 = buildNode("prompt", 640, 2300, {
    content: "Make it more vibrant, add dramatic god rays and glowing crystals",
  });
  const pcGenerate2 = buildNode("generate", 920, 2300, {
    model: imageModel.id,
    outputType: imageModel.outputType,
  });

  // 9. Batch Premium
  const bpPrompt = buildNode("prompt", 80, 2700, {
    content: "High-end product photography of a luxury mechanical watch",
  });
  const bpGenerate = buildNode("generate", 360, 2680, {
    model: premiumModel.id,
    outputType: premiumModel.outputType,
  });

  // 10. Style Transfer
  const stSource = buildNode("source", 80, 3060, { fileType: "image" });
  const stPrompt = buildNode("prompt", 80, 3220, {
    content: "Apply a cyberpunk neon style with magenta, cyan and deep purple tones",
  });
  const stGenerate = buildNode("generate", 360, 3120, {
    model: imageModel.id,
    outputType: imageModel.outputType,
  });

  // 11. Video Batch
  const vbSource = buildNode("source", 80, 3520, { fileType: "image" });
  const vbPrompt = buildNode("prompt", 80, 3700, {
    content: "Create dramatic cinematic motion from this image with slow zooms and pans",
  });
  const vbGenerate = buildNode("generate", 360, 3580, {
    model: videoModel.id,
    outputType: videoModel.outputType,
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
    {
      ...BUILTIN_TEMPLATES[3],
      elements: [ttvPrompt, ttvGenerate],
      connections: [wire(ttvPrompt, ttvGenerate)],
    },
    {
      ...BUILTIN_TEMPLATES[4],
      elements: [itiSource, itiPrompt, itiGenerate],
      connections: [wire(itiSource, itiGenerate), wire(itiPrompt, itiGenerate)],
    },
    {
      ...BUILTIN_TEMPLATES[5],
      elements: [dmPrompt, dmGenerate1, dmGenerate2],
      connections: [wire(dmPrompt, dmGenerate1), wire(dmPrompt, dmGenerate2)],
    },
    {
      ...BUILTIN_TEMPLATES[6],
      elements: [asSource, asGenerate],
      connections: [wire(asSource, asGenerate)],
    },
    {
      ...BUILTIN_TEMPLATES[7],
      elements: [pcPrompt1, pcGenerate1, pcPrompt2, pcGenerate2],
      connections: [
        wire(pcPrompt1, pcGenerate1),
        wire(pcGenerate1, pcPrompt2),
        wire(pcPrompt2, pcGenerate2),
      ],
    },
    {
      ...BUILTIN_TEMPLATES[8],
      elements: [bpPrompt, bpGenerate],
      connections: [wire(bpPrompt, bpGenerate)],
    },
    {
      ...BUILTIN_TEMPLATES[9],
      elements: [stSource, stPrompt, stGenerate],
      connections: [wire(stSource, stGenerate), wire(stPrompt, stGenerate)],
    },
    {
      ...BUILTIN_TEMPLATES[10],
      elements: [vbSource, vbPrompt, vbGenerate],
      connections: [wire(vbSource, vbGenerate), wire(vbPrompt, vbGenerate)],
    },
  ].map(addMissingGenerateOutputs);
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

function addMissingGenerateOutputs(template: Template): Template {
  const elements = [...template.elements];
  const connections = [...template.connections];

  for (const generate of template.elements) {
    if (generate.type !== "generate" || !generate.nodeData) continue;
    const hasOutput = connections.some((connection) => {
      if (connection.fromId !== generate.id) return false;
      return elements.some((element) => element.id === connection.toId && element.type === "output");
    });
    if (hasOutput) continue;

    const output = buildNode(
      "output",
      generate.x + Math.max(generate.width, 200) + 64,
      generate.y,
      {
        outputIndex: "0",
        outputType: generate.nodeData.properties.outputType ?? "image",
      }
    );
    elements.push(output);
    connections.push(wire(generate, output));
  }

  return { ...template, elements, connections };
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
