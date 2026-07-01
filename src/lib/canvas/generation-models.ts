export type GenerationOutputType = "image" | "video";

export type GenerationModel = {
  id: string;
  label: string;
  outputType: GenerationOutputType;
  supportsDuration: boolean;
  supportsImageInput: boolean;
  maxOutputs: number;
};

export const GENERATION_MODELS: GenerationModel[] = [
  {
    id: "google/gemini-3.1-flash-lite-image",
    label: "Google: Nano Banana 2 Lite",
    outputType: "image",
    supportsDuration: false,
    supportsImageInput: true,
    maxOutputs: 4,
  },
  {
    id: "google/gemini-3.1-flash-image",
    label: "Google: Nano Banana 2",
    outputType: "image",
    supportsDuration: false,
    supportsImageInput: true,
    maxOutputs: 4,
  },
  {
    id: "google/gemini-3-pro-image",
    label: "Google: Nano Banana Pro",
    outputType: "image",
    supportsDuration: false,
    supportsImageInput: true,
    maxOutputs: 4,
  },
  {
    id: "openai/gpt-5.4-image-2",
    label: "OpenAI: GPT-5.4 Image 2",
    outputType: "image",
    supportsDuration: false,
    supportsImageInput: false,
    maxOutputs: 4,
  },
  {
    id: "google/gemini-3.1-flash-image-preview",
    label: "Google: Nano Banana 2 Preview",
    outputType: "image",
    supportsDuration: false,
    supportsImageInput: true,
    maxOutputs: 4,
  },
  {
    id: "google/gemini-3-pro-image-preview",
    label: "Google: Nano Banana Pro Preview",
    outputType: "image",
    supportsDuration: false,
    supportsImageInput: true,
    maxOutputs: 4,
  },
  {
    id: "openai/gpt-5-image-mini",
    label: "OpenAI: GPT-5 Image Mini",
    outputType: "image",
    supportsDuration: false,
    supportsImageInput: false,
    maxOutputs: 4,
  },
  {
    id: "openai/gpt-5-image",
    label: "OpenAI: GPT-5 Image",
    outputType: "image",
    supportsDuration: false,
    supportsImageInput: false,
    maxOutputs: 4,
  },
  {
    id: "google/gemini-2.5-flash-image",
    label: "Google: Nano Banana",
    outputType: "image",
    supportsDuration: false,
    supportsImageInput: true,
    maxOutputs: 4,
  },
  {
    id: "kwaivgi/kling-v3.0-pro",
    label: "Kling 3.0 Pro",
    outputType: "video",
    supportsDuration: true,
    supportsImageInput: true,
    maxOutputs: 4,
  },
  {
    id: "kwaivgi/kling-v3.0-std",
    label: "Kling 3.0 Standard",
    outputType: "video",
    supportsDuration: true,
    supportsImageInput: true,
    maxOutputs: 4,
  },
  {
    id: "alibaba/happyhorse-1.1",
    label: "Alibaba: HappyHorse 1.1",
    outputType: "video",
    supportsDuration: true,
    supportsImageInput: true,
    maxOutputs: 4,
  },
  {
    id: "alibaba/happyhorse-1.0",
    label: "Alibaba: HappyHorse 1.0",
    outputType: "video",
    supportsDuration: true,
    supportsImageInput: true,
    maxOutputs: 4,
  },
  {
    id: "x-ai/grok-imagine-video",
    label: "xAI: Grok Imagine Video",
    outputType: "video",
    supportsDuration: true,
    supportsImageInput: true,
    maxOutputs: 4,
  },
  {
    id: "google/veo-3.1-fast",
    label: "Google: Veo 3.1 Fast",
    outputType: "video",
    supportsDuration: true,
    supportsImageInput: true,
    maxOutputs: 4,
  },
  {
    id: "google/veo-3.1-lite",
    label: "Google: Veo 3.1 Lite",
    outputType: "video",
    supportsDuration: true,
    supportsImageInput: true,
    maxOutputs: 4,
  },
  {
    id: "kwaivgi/kling-video-o1",
    label: "Kling: Video O1",
    outputType: "video",
    supportsDuration: true,
    supportsImageInput: true,
    maxOutputs: 4,
  },
  {
    id: "minimax/hailuo-2.3",
    label: "MiniMax: Hailuo 2.3",
    outputType: "video",
    supportsDuration: true,
    supportsImageInput: true,
    maxOutputs: 4,
  },
  {
    id: "bytedance/seedance-2.0-fast",
    label: "ByteDance: Seedance 2.0 Fast",
    outputType: "video",
    supportsDuration: true,
    supportsImageInput: true,
    maxOutputs: 4,
  },
];

export const DEFAULT_GENERATION_MODEL = GENERATION_MODELS[0];

export function getGenerationModel(id?: string) {
  return GENERATION_MODELS.find((model) => model.id === id) ?? DEFAULT_GENERATION_MODEL;
}

export function normalizeOutputCount(value: string | undefined, modelId?: string) {
  const model = getGenerationModel(modelId);
  const parsed = Number.parseInt(value || "1", 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(Math.max(parsed, 1), model.maxOutputs);
}
