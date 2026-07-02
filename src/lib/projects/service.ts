"use server";

import { createClient } from "@/lib/supabase/server";
import type { CanvasElement, Camera, Connection, WorkflowState } from "@/types/canvas";

export type Folder = {
  id: string;
  name: string;
  created_at: string;
};

export type ProjectConfig = {
  pinned?: boolean;
  archived?: boolean;
  archived_at?: string | null;
  [key: string]: unknown;
};

export type Project = {
  id: string;
  folder_id: string | null;
  name: string;
  workflow: WorkflowState;
  config: ProjectConfig;
  created_at: string;
  updated_at: string;
};

export type ProjectInput = {
  folder_id?: string | null;
  name: string;
};

export type GeneratedMedia = {
  id: string;
  project_id: string;
  node_id: string;
  output_index: number;
  media_type: "image" | "video";
  url: string;
  model: string | null;
  prompt: string | null;
  source_url: string | null;
  created_at: string;
};

export type GeneratedMediaInput = {
  projectId: string;
  nodeId: string;
  outputIndex: number;
  mediaType: "image" | "video";
  url: string;
  model?: string;
  prompt?: string;
  sourceUrl?: string;
};

export type AgentChat = {
  id: string;
  project_id: string;
  title: string;
  pinned: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type AgentMessage = {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type AgentCheckpoint = {
  id: string;
  chat_id: string;
  message_id: string;
  label: string | null;
  workflow_state: WorkflowState;
  created_at: string;
};

export type AgentCheckpointInput = {
  chatId: string;
  messageId: string;
  label?: string;
  workflowState: WorkflowState;
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

export async function updateFolderName(id: string, name: string): Promise<Folder> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("folders")
    .update({ name })
    .eq("id", id)
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
  return (data ?? []).map((p) => ({
    ...p,
    workflow: normalizeWorkflow(p.workflow),
  }));
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

export async function updateProjectName(
  id: string,
  name: string
): Promise<Project> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { ...data, workflow: normalizeWorkflow(data.workflow) };
}

export async function updateProjectConfig(
  id: string,
  patch: ProjectConfig
): Promise<Project> {
  const current = await getProject(id);
  if (!current) throw new Error("Project not found");
  const config = { ...current.config, ...patch };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ config, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { ...data, workflow: normalizeWorkflow(data.workflow) };
}

export async function duplicateProject(id: string): Promise<Project> {
  const current = await getProject(id);
  if (!current) throw new Error("Project not found");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      folder_id: current.folder_id,
      name: `${current.name} copy`,
      workflow: current.workflow,
      config: { ...current.config, pinned: false, archived: false, archived_at: null },
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { ...data, workflow: normalizeWorkflow(data.workflow) };
}

export async function updateProjectWorkflow(
  id: string,
  workflow: WorkflowState
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

export async function updateProjectFolder(
  id: string,
  folderId: string | null
): Promise<Project> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ folder_id: folderId, updated_at: new Date().toISOString() })
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

export async function deleteFolder(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("folders").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listGeneratedMedia(projectId: string): Promise<GeneratedMedia[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("generated_media")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as GeneratedMedia[];
}

export async function saveGeneratedMedia(input: GeneratedMediaInput): Promise<GeneratedMedia> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("generated_media")
    .insert({
      project_id: input.projectId,
      node_id: input.nodeId,
      output_index: input.outputIndex,
      media_type: input.mediaType,
      url: input.url,
      model: input.model ?? null,
      prompt: input.prompt ?? null,
      source_url: input.sourceUrl ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as GeneratedMedia;
}

export async function listAgentChats(projectId: string): Promise<AgentChat[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agent_chats")
    .select("*")
    .eq("project_id", projectId)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AgentChat[];
}

export async function createAgentChat(
  projectId: string,
  title = "New chat"
): Promise<AgentChat> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agent_chats")
    .insert({ project_id: projectId, title })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as AgentChat;
}

export async function updateAgentChat(
  id: string,
  patch: Partial<Pick<AgentChat, "title" | "pinned" | "archived">>
): Promise<AgentChat> {
  const supabase = await createClient();
  const update: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
  if (patch.archived && patch.pinned === undefined) {
    update.pinned = false;
  }
  const { data, error } = await supabase
    .from("agent_chats")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as AgentChat;
}

export async function deleteAgentChat(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("agent_chats").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listAgentMessages(chatId: string): Promise<AgentMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agent_messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AgentMessage[];
}

export async function createAgentMessage(
  chatId: string,
  role: "user" | "assistant",
  content: string
): Promise<AgentMessage> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agent_messages")
    .insert({ chat_id: chatId, role, content })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as AgentMessage;
}

export async function listAgentCheckpoints(chatId: string): Promise<AgentCheckpoint[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agent_checkpoints")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({
    ...c,
    workflow_state: normalizeWorkflow(c.workflow_state),
  })) as AgentCheckpoint[];
}

export async function createAgentCheckpoint(
  input: AgentCheckpointInput
): Promise<AgentCheckpoint> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agent_checkpoints")
    .insert({
      chat_id: input.chatId,
      message_id: input.messageId,
      label: input.label ?? null,
      workflow_state: input.workflowState,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Checkpoint creation failed");
  const row = data as Record<string, unknown>;
  return {
    ...row,
    workflow_state: normalizeWorkflow(row.workflow_state),
  } as AgentCheckpoint;
}

export async function getAgentCheckpoint(id: string): Promise<AgentCheckpoint | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agent_checkpoints")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  return {
    ...row,
    workflow_state: normalizeWorkflow(row.workflow_state),
  } as AgentCheckpoint;
}

export async function deleteAgentCheckpoint(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("agent_checkpoints").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

function normalizeWorkflow(raw: unknown): WorkflowState {
  const empty: WorkflowState = {
    elements: [],
    camera: { x: 0, y: 0, zoom: 1 },
    connections: [],
    ui: { snapToGrid: true, showGrid: true },
  };
  if (typeof raw !== "object" || raw === null) return empty;
  const w = raw as Record<string, unknown>;
  return {
    elements: Array.isArray(w.elements)
      ? (w.elements as CanvasElement[])
      : empty.elements,
    camera:
      typeof w.camera === "object" && w.camera !== null
        ? ({ ...empty.camera, ...(w.camera as Record<string, unknown>) } as Camera)
        : empty.camera,
    connections: Array.isArray(w.connections)
      ? (w.connections as Connection[])
      : empty.connections,
    ui:
      typeof w.ui === "object" && w.ui !== null
        ? { ...empty.ui, ...(w.ui as Record<string, boolean>) }
        : empty.ui,
  };
}
