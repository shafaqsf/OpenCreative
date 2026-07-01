"use server";

import { createClient } from "@/lib/supabase/server";
import type { Camera, CanvasElement } from "@/types/canvas";

export type Folder = {
  id: string;
  name: string;
  created_at: string;
};

export type Project = {
  id: string;
  folder_id: string | null;
  name: string;
  workflow: { elements: CanvasElement[]; camera: Camera };
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ProjectInput = {
  folder_id?: string | null;
  name: string;
};

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
  return (data ?? []).map((p) => ({ ...p, workflow: normalizeWorkflow(p.workflow) }));
}

export async function getProject(id: string): Promise<Project | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return { ...data, workflow: normalizeWorkflow(data.workflow) };
}

export async function createProject(input: ProjectInput): Promise<Project> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({ folder_id: input.folder_id ?? null, name: input.name })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { ...data, workflow: normalizeWorkflow(data.workflow) };
}

export async function updateProjectWorkflow(
  id: string,
  workflow: { elements: CanvasElement[]; camera: Camera }
): Promise<Project> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ workflow, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { ...data, workflow: normalizeWorkflow(data.workflow) };
}

export async function deleteProject(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

function normalizeWorkflow(raw: unknown): { elements: CanvasElement[]; camera: Camera } {
  const empty = { elements: [] as CanvasElement[], camera: { x: 0, y: 0, zoom: 1 } };
  if (typeof raw !== "object" || raw === null) return empty;
  const w = raw as Record<string, unknown>;
  const elements = Array.isArray(w.elements) ? (w.elements as CanvasElement[]) : empty.elements;
  const camera =
    typeof w.camera === "object" && w.camera !== null
      ? ({ ...empty.camera, ...(w.camera as Record<string, unknown>) } as Camera)
      : empty.camera;
  return { elements, camera };
}