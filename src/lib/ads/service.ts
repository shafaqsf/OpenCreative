"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  AdType,
  Asset,
  AssetType,
  Folder,
  GenerationJob,
  Output,
  Project,
  ProjectConfig,
} from "@/types/ads";

export async function listFolders(): Promise<Folder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("folders")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createFolder(name: string): Promise<Folder> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("folders")
    .insert({ name })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listProjects(folderId?: string): Promise<Project[]> {
  const supabase = await createClient();
  let query = supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });
  if (folderId) query = query.eq("folder_id", folderId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getProject(id: string): Promise<Project | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}

export async function createProject(
  folderId: string | null,
  name: string,
  adType: AdType
): Promise<Project> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({ folder_id: folderId, name, ad_type: adType, config: {} })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateProjectConfig(
  id: string,
  config: ProjectConfig
): Promise<Project> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ config, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteProject(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listAssets(projectId: string): Promise<Asset[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createAsset(
  projectId: string,
  type: AssetType,
  name: string,
  url: string
): Promise<Asset> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .insert({ project_id: projectId, type, name, url })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listJobs(projectId: string): Promise<GenerationJob[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("generation_jobs")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listOutputs(jobId: string): Promise<Output[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("outputs")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}