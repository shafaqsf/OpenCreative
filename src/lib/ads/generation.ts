"use server";

import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { openrouter } from "@/lib/ai/openrouter";
import type { GenerationJob, Project } from "@/types/ads";

export const VIDEO_MODELS = [
  "kwaivgi/kling-v3.0-pro",
  "kwaivgi/kling-v3.0-std",
  "bytedance/seedance-2.0-fast",
  "bytedance/seedance-2.0",
  "minimax/hailuo-2.3",
];

export const FALLBACK_IMAGE_MODELS = [
  "google/gemini-3.1-flash-image",
  "openai/gpt-5.4-image-2",
];

function extractUrl(text: string): string | null {
  const md = text.match(/!?\[.*?\]\((https?:\/\/[^\s)]+)\)/);
  if (md) return md[1];
  const raw = text.match(/(https?:\/\/[^\s"'<>]+\.(?:mp4|webm|mov|png|jpg|jpeg|gif|webp))/i);
  if (raw) return raw[1];
  const any = text.match(/(https?:\/\/[^\s"'<>]+)/);
  return any ? any[1] : null;
}

export async function generateAdCreative(
  project: Project,
  model: string,
  prompt: string,
  imageUrl?: string
): Promise<GenerationJob> {
  const supabase = await createClient();

  const { data: job, error: jobError } = await supabase
    .from("generation_jobs")
    .insert({
      project_id: project.id,
      status: "pending",
      model,
      prompt,
      config: { ad_type: project.ad_type, image_url: imageUrl ?? null },
    })
    .select()
    .single();

  if (jobError || !job) throw new Error(jobError?.message ?? "Failed to create job");

  try {
    const content: OpenAI.Chat.ChatCompletionContentPart[] = [
      { type: "text", text: prompt },
    ];
    if (imageUrl) {
      content.push({ type: "image_url", image_url: { url: imageUrl } });
    }

    const completion = await openrouter.chat.completions.create({
      model,
      messages: [{ role: "user", content }],
      max_tokens: 2048,
    });

    const message = completion.choices[0]?.message;
    const responseText = message?.content ?? "";
    const url = extractUrl(responseText);

    if (!url) {
      throw new Error("Model did not return a media URL. Response: " + responseText.slice(0, 200));
    }

    const isVideo = /\.(mp4|webm|mov)/i.test(url);

    await supabase.from("outputs").insert({
      job_id: job.id,
      type: isVideo ? "video" : "image",
      url,
      thumbnail_url: isVideo ? null : url,
    });

    const { data: updated } = await supabase
      .from("generation_jobs")
      .update({
        status: "done",
        credits_used: completion.usage?.total_tokens ?? null,
      })
      .eq("id", job.id)
      .select()
      .single();

    return updated ?? job;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("generation_jobs")
      .update({ status: "error", error: message })
      .eq("id", job.id);
    throw err;
  }
}