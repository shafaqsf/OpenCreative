import { createClient } from "@/lib/supabase/client";
import type { CanvasElement, Camera, Connection, WorkflowState } from "@/types/canvas";
import type {
  AgentChat,
  AgentCheckpoint,
  AgentCheckpointInput,
  AgentMessage,
  GeneratedMedia,
  GeneratedMediaInput,
  Project,
} from "@/lib/projects/service";

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

export async function updateProjectWorkflow(
  id: string,
  workflow: WorkflowState
): Promise<Project> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ workflow, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to update workflow");
  return { ...data, workflow: normalizeWorkflow(data.workflow) } as Project;
}

export async function saveGeneratedMedia(input: GeneratedMediaInput): Promise<GeneratedMedia> {
  const supabase = createClient();
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
  if (error || !data) throw new Error(error?.message ?? "Failed to save generated media");
  return data as GeneratedMedia;
}

export async function listAgentChats(projectId: string): Promise<AgentChat[]> {
  const supabase = createClient();
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
  const supabase = createClient();
  const { data, error } = await supabase
    .from("agent_chats")
    .insert({ project_id: projectId, title })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create chat");
  return data as AgentChat;
}

export async function updateAgentChat(
  id: string,
  patch: Partial<Pick<AgentChat, "title" | "pinned" | "archived">>
): Promise<AgentChat> {
  const supabase = createClient();
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
  if (error || !data) throw new Error(error?.message ?? "Failed to update chat");
  return data as AgentChat;
}

export async function deleteAgentChat(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("agent_chats").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listAgentMessages(chatId: string): Promise<AgentMessage[]> {
  const supabase = createClient();
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
  const supabase = createClient();
  const { data, error } = await supabase
    .from("agent_messages")
    .insert({ chat_id: chatId, role, content })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create message");
  return data as AgentMessage;
}

export async function listAgentCheckpoints(chatId: string): Promise<AgentCheckpoint[]> {
  const supabase = createClient();
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
  const supabase = createClient();
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
  const supabase = createClient();
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
  const supabase = createClient();
  const { error } = await supabase.from("agent_checkpoints").delete().eq("id", id);
  if (error) throw new Error(error.message);
}