import { uid, newNode } from "./context";
import type { CanvasElement, Connection, NodeType } from "@/types/canvas";

export type Template = {
  id: string;
  name: string;
  description: string;
  elements: CanvasElement[];
  connections: Connection[];
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
    description: "Source → Generate → Output",
    elements: [],
    connections: [],
  },
  {
    id: "multi-variation",
    name: "Multi-variation",
    description: "Prompt → Generate 4 outputs",
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
  const prompt = buildNode("prompt", 80, 120);
  const generate1 = buildNode("generate", 360, 120, {
    prompt: "A cinematic scene based on the prompt",
  });
  const output1 = buildNode("output", 620, 120, { outputIndex: "0" });

  const source = buildNode("source", 80, 320, { fileType: "image" });
  const generate2 = buildNode("generate", 360, 320, {
    prompt: "Animate this image into a video",
  });
  const output2 = buildNode("output", 620, 320, { outputIndex: "0" });

  const prompt3 = buildNode("prompt", 80, 520);
  const generate3 = buildNode("generate", 360, 520, {
    prompt: "Four creative variations",
    count: "4",
  });

  return [
    {
      ...BUILTIN_TEMPLATES[0],
      elements: [prompt, generate1, output1],
      connections: [wire(prompt, generate1), wire(generate1, output1)],
    },
    {
      ...BUILTIN_TEMPLATES[1],
      elements: [source, generate2, output2],
      connections: [wire(source, generate2), wire(generate2, output2)],
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
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveCustomTemplates(templates: Template[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
}

export function addCustomTemplate(template: Template) {
  const existing = loadCustomTemplates();
  saveCustomTemplates([...existing, template]);
}
