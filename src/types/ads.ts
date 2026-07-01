export type AdType =
  | "ai_actor"
  | "fashion_tryon"
  | "product_showcase"
  | "hook_repurpose"
  | "text_to_video";

export type AssetType = "image" | "video" | "audio";
export type JobStatus = "pending" | "running" | "done" | "error";
export type OutputType = "image" | "video";

export type Folder = {
  id: string;
  name: string;
  created_at: string;
};

export type Project = {
  id: string;
  folder_id: string | null;
  name: string;
  ad_type: AdType;
  config: ProjectConfig;
  created_at: string;
  updated_at: string;
};

export type ProjectConfig = {
  script?: string;
  actor_description?: string;
  emotion?: string;
  voice_model?: string;
  scene_prompt?: string;
  product_image_asset_id?: string;
  reference_video_asset_id?: string;
  avatar_image_asset_id?: string;
  model?: string;
  aspect_ratio?: "9:16" | "16:9" | "1:1";
  duration_seconds?: number;
  [key: string]: unknown;
};

export type Asset = {
  id: string;
  project_id: string;
  type: AssetType;
  name: string;
  url: string;
  created_at: string;
};

export type GenerationJob = {
  id: string;
  project_id: string;
  status: JobStatus;
  model: string;
  prompt: string;
  config: Record<string, unknown>;
  credits_used: number | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export type Output = {
  id: string;
  job_id: string;
  type: OutputType;
  url: string;
  thumbnail_url: string | null;
  duration: number | null;
  created_at: string;
};