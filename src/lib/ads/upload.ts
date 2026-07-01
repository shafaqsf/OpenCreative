"use server";

import { createClient } from "@/lib/supabase/server";

export async function uploadAsset(
  projectId: string,
  fileName: string,
  base64: string,
  contentType: string
): Promise<string> {
  const supabase = await createClient();
  const ext = fileName.split(".").pop() ?? "bin";
  const path = `${projectId}/${Date.now()}.${ext}`;

  const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
  const buffer = Buffer.from(base64Data, "base64");

  const { error } = await supabase.storage
    .from("assets")
    .upload(path, buffer, { contentType, upsert: false });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from("assets").getPublicUrl(path);
  return data.publicUrl;
}