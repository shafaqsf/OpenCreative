export type GenerationOutputType = "image" | "video";

export type GenerationModel = {
  id: string;
  label: string;
  outputType: GenerationOutputType;
  outputFormat: string;
  supportsDuration: boolean;
  maxOutputs: number;
};

export const GENERATION_MODELS: GenerationModel[] = [
  {
    id: "kwaivgi/kling-v3.0-pro",
    label: "Kling 3.0 Pro",
    outputType: "video",
    outputFormat: "mp4",
    supportsDuration: true,
    maxOutputs: 4,
  },
  {
    id: "kwaivgi/kling-v3.0-std",
    label: "Kling 3.0 Standard",
    outputType: "video",
    outputFormat: "mp4",
    supportsDuration: true,
    maxOutputs: 4,
  },
  {
    id: "bytedance/seedance-2.0-fast",
    label: "Seedance 2.0 Fast",
    outputType: "video",
    outputFormat: "mp4",
    supportsDuration: true,
    maxOutputs: 4,
  },
  {
    id: "bytedance/seedance-2.0",
    label: "Seedance 2.0",
    outputType: "video",
    outputFormat: "mp4",
    supportsDuration: true,
    maxOutputs: 4,
  },
  {
    id: "minimax/hailuo-2.3",
    label: "Hailuo 2.3",
    outputType: "video",
    outputFormat: "mp4",
    supportsDuration: true,
    maxOutputs: 4,
  },
  {
    id: "openai/gpt-image-1",
    label: "GPT Image 1",
    outputType: "image",
    outputFormat: "png",
    supportsDuration: false,
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
