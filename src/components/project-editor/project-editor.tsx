"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Upload, Wand2, Download } from "lucide-react";
import {
  updateProjectConfig,
  listAssets,
  listJobs,
  listOutputs,
  createAsset,
} from "@/lib/ads/service";
import { uploadAsset } from "@/lib/ads/upload";
import { generateAdCreative, VIDEO_MODELS } from "@/lib/ads/generation";
import type { Asset, GenerationJob, Output, Project } from "@/types/ads";

export function ProjectEditor({ project }: { project: Project }) {
  const [config, setConfig] = useState(project.config);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [outputsByJob, setOutputsByJob] = useState<Record<string, Output[]>>({});
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [a, j] = await Promise.all([
      listAssets(project.id),
      listJobs(project.id),
    ]);
    setAssets(a);
    setJobs(j);
    const outs: Record<string, Output[]> = {};
    await Promise.all(
      j.map(async (job) => {
        outs[job.id] = await listOutputs(job.id);
      })
    );
    setOutputsByJob(outs);
  }, [project.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function saveConfig(updates: Record<string, unknown>) {
    setSaving(true);
    const next = { ...config, ...updates };
    setConfig(next);
    await updateProjectConfig(project.id, next);
    setSaving(false);
  }

  async function handleFileUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    type: "product_image_asset_id" | "reference_video_asset_id" | "avatar_image_asset_id"
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          const url = await uploadAsset(project.id, file.name, base64, file.type);
          const assetType = file.type.startsWith("video") ? "video" : "image";
          const asset = await createAsset(
            project.id,
            assetType,
            file.name,
            url
          );
          await saveConfig({ [type]: asset.id });
          await refresh();
        };
        reader.readAsDataURL(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const prompt = buildPrompt(project.ad_type, config);
      const imageAssetId =
        config.product_image_asset_id ?? config.avatar_image_asset_id;
      const imageUrl = imageAssetId
        ? assets.find((a) => a.id === imageAssetId)?.url
        : undefined;
      const model = config.model ?? VIDEO_MODELS[0];
      await generateAdCreative(project, model, prompt, imageUrl);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex h-dvh w-dvw flex-col overflow-hidden bg-white text-neutral-900">
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3.5">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex size-8 items-center justify-center rounded-md hover:bg-neutral-100"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="text-sm font-semibold">{project.name}</h1>
            <p className="text-xs text-neutral-500">
              {project.ad_type.replace(/_/g, " ")}
            </p>
          </div>
        </div>
        {saving && (
          <span className="flex items-center gap-1.5 text-xs text-neutral-400">
            <Loader2 className="size-3 animate-spin" />
            Saving…
          </span>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto border-r border-neutral-200 p-6">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mx-auto max-w-2xl space-y-6">
            {project.ad_type === "ai_actor" && (
              <>
                <Field label="Script">
                  <textarea
                    value={config.script ?? ""}
                    onChange={(e) => saveConfig({ script: e.target.value })}
                    rows={5}
                    className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                    placeholder="Paste your ad script here…"
                  />
                </Field>
                <Field label="Actor description">
                  <input
                    value={config.actor_description ?? ""}
                    onChange={(e) =>
                      saveConfig({ actor_description: e.target.value })
                    }
                    className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                    placeholder="e.g. young woman in a bright bathroom"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Emotion">
                    <input
                      value={config.emotion ?? ""}
                      onChange={(e) => saveConfig({ emotion: e.target.value })}
                      className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                      placeholder="excited, satisfied"
                    />
                  </Field>
                  <Field label="Voice model">
                    <input
                      value={config.voice_model ?? ""}
                      onChange={(e) =>
                        saveConfig({ voice_model: e.target.value })
                      }
                      className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                      placeholder="default"
                    />
                  </Field>
                </div>
              </>
            )}

            {(project.ad_type === "fashion_tryon" ||
              project.ad_type === "product_showcase") && (
              <>
                <Field label="Product image">
                  <AssetUploader
                    asset={assets.find(
                      (a) => a.id === config.product_image_asset_id
                    )}
                    onUpload={(e) => handleFileUpload(e, "product_image_asset_id")}
                  />
                </Field>
                <Field label="Scene prompt">
                  <textarea
                    value={config.scene_prompt ?? ""}
                    onChange={(e) => saveConfig({ scene_prompt: e.target.value })}
                    rows={4}
                    className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                    placeholder="Describe the scene, model action, and framing…"
                  />
                </Field>
              </>
            )}

            {project.ad_type === "hook_repurpose" && (
              <>
                <Field label="Reference video">
                  <AssetUploader
                    asset={assets.find(
                      (a) => a.id === config.reference_video_asset_id
                    )}
                    onUpload={(e) =>
                      handleFileUpload(e, "reference_video_asset_id")
                    }
                    accept="video/*"
                  />
                </Field>
                <Field label="New script / product name">
                  <textarea
                    value={config.script ?? ""}
                    onChange={(e) => saveConfig({ script: e.target.value })}
                    rows={4}
                    className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                    placeholder="What should the actor say about your product?"
                  />
                </Field>
              </>
            )}

            {project.ad_type === "text_to_video" && (
              <>
                <Field label="Prompt">
                  <textarea
                    value={config.scene_prompt ?? ""}
                    onChange={(e) => saveConfig({ scene_prompt: e.target.value })}
                    rows={5}
                    className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                    placeholder="Describe the video you want to generate…"
                  />
                </Field>
                <Field label="Optional reference image">
                  <AssetUploader
                    asset={assets.find(
                      (a) => a.id === config.product_image_asset_id
                    )}
                    onUpload={(e) => handleFileUpload(e, "product_image_asset_id")}
                  />
                </Field>
              </>
            )}

            <Field label="Model">
              <select
                value={config.model ?? VIDEO_MODELS[0]}
                onChange={(e) => saveConfig({ model: e.target.value })}
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900"
              >
                {VIDEO_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wand2 className="size-4" />
              )}
              {generating ? "Generating…" : "Generate"}
            </button>
          </div>
        </main>

        <aside className="w-80 overflow-y-auto bg-neutral-50 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Generations
          </h3>
          {jobs.length === 0 ? (
            <p className="text-xs text-neutral-400">No generations yet.</p>
          ) : (
            <ul className="space-y-3">
              {jobs.map((job) => (
                <li
                  key={job.id}
                  className="rounded-lg border border-neutral-200 bg-white p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        job.status === "done"
                          ? "bg-neutral-900 text-white"
                          : job.status === "error"
                            ? "bg-red-100 text-red-700"
                            : "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {job.status}
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      {new Date(job.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mb-2 line-clamp-2 text-xs text-neutral-600">
                    {job.prompt}
                  </p>
                  {job.error && (
                    <p className="mb-2 text-[10px] text-red-600">{job.error}</p>
                  )}
                  <div className="space-y-2">
                    {(outputsByJob[job.id] ?? []).map((out) => (
                      <OutputCard key={out.id} output={out} />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-neutral-700">{label}</span>
      {children}
    </label>
  );
}

function AssetUploader({
  asset,
  onUpload,
  accept = "image/*",
}: {
  asset?: Asset;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  accept?: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-neutral-300 p-4">
      {asset ? (
        <div className="space-y-2">
          {asset.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={asset.url}
              alt={asset.name}
              className="h-32 w-full rounded-md object-cover"
            />
          ) : (
            <video
              src={asset.url}
              className="h-32 w-full rounded-md object-cover"
              controls
            />
          )}
          <p className="text-xs text-neutral-500">{asset.name}</p>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 text-neutral-500 hover:text-neutral-900">
          <Upload className="size-5" />
          <span className="text-xs">Click to upload</span>
          <input
            type="file"
            accept={accept}
            onChange={onUpload}
            className="hidden"
          />
        </label>
      )}
    </div>
  );
}

function OutputCard({ output }: { output: Output }) {
  return (
    <div className="rounded border border-neutral-200 bg-white p-2">
      {output.type === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={output.url}
          alt="Generated output"
          className="mb-2 h-32 w-full rounded object-cover"
        />
      ) : (
        <video
          src={output.url}
          className="mb-2 h-32 w-full rounded object-cover"
          controls
        />
      )}
      <a
        href={output.url}
        download
        className="flex items-center justify-center gap-1 rounded bg-neutral-900 py-1 text-xs text-white hover:bg-neutral-800"
      >
        <Download className="size-3" />
        Download
      </a>
    </div>
  );
}

function buildPrompt(adType: string, config: Record<string, unknown>): string {
  switch (adType) {
    case "ai_actor":
      return `Create a realistic UGC talking-head video. Script: ${config.script ?? ""}. Actor: ${config.actor_description ?? ""}. Emotion: ${config.emotion ?? ""}.`;
    case "fashion_tryon":
      return `Fashion try-on video. Scene: ${config.scene_prompt ?? ""}. The model should be wearing the uploaded product.`;
    case "product_showcase":
      return `Product showcase video. Scene: ${config.scene_prompt ?? ""}. The actor should be holding or using the uploaded product.`;
    case "hook_repurpose":
      return `Repurpose this hook video style with the following new script: ${config.script ?? ""}. Match the energy and framing of the reference video.`;
    case "text_to_video":
      return config.scene_prompt as string;
    default:
      return "";
  }
}