"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, Clipboard, History, Loader2, MessageSquare, Pencil, Pin, Play, RotateCcw, Send, Sparkles, Trash2, X } from "lucide-react";
import { newNode, uid, useCanvas } from "@/lib/canvas/context";
import { useToast } from "@/lib/toast/context";
import type { AgentAction, AgentMessage, AgentResponse, CanvasCheckpoint } from "@/types/agent";
import type { NodeType, ToolId, WorkflowState } from "@/types/canvas";

type ConversationState = {
  title: string;
  pinned: boolean;
  archived: boolean;
  messages: AgentMessage[];
  checkpoints: CanvasCheckpoint[];
};

const emptyConversation: ConversationState = {
  title: "Agent session",
  pinned: false,
  archived: false,
  messages: [],
  checkpoints: [],
};

export function AIPanel({
  projectId = "local",
  projectName = "Untitled project",
}: {
  projectId?: string;
  projectName?: string;
}) {
  const {
    elements,
    connections,
    camera,
    selectedIds,
    activeTool,
    addElement,
    addConnection,
    removeElements,
    duplicateSelection,
    renameElement,
    replaceWorkflow,
    runWorkflow,
    setActiveTool,
  } = useCanvas();
  const { addToast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<ConversationState>(emptyConversation);

  const storageKey = `opencreative:agent:${projectId}`;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        setConversation({ ...emptyConversation, ...JSON.parse(raw) });
      }
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(conversation));
  }, [conversation, storageKey]);

  const workflow = useMemo<WorkflowState>(
    () => ({ elements, connections, camera }),
    [elements, connections, camera]
  );

  function updateConversation(patch: Partial<ConversationState>) {
    setConversation((prev) => ({ ...prev, ...patch }));
  }

  function appendMessages(messages: AgentMessage[]) {
    setConversation((prev) => ({
      ...prev,
      messages: [...prev.messages, ...messages],
    }));
  }

  function createCheckpoint(name: string) {
    const checkpoint: CanvasCheckpoint = {
      id: uid(),
      name,
      workflow,
      createdAt: new Date().toISOString(),
    };
    setConversation((prev) => ({
      ...prev,
      checkpoints: [checkpoint, ...prev.checkpoints].slice(0, 20),
    }));
    return checkpoint;
  }

  async function executeAction(action: AgentAction) {
    switch (action.type) {
      case "create_nodes": {
        const created = action.nodes.map((node) => {
          const el = newNode(node.type as NodeType, node.x, node.y);
          el.nodeData!.properties = {
            ...el.nodeData!.properties,
            ...(node.properties ?? {}),
          };
          return el;
        });
        created.forEach(addElement);
        action.connections?.forEach((connection) => {
          const from = created[connection.from];
          const to = created[connection.to];
          if (from && to) addConnection(from.id, to.id);
        });
        addToast({ title: "Agent updated canvas", message: `Created ${created.length} node${created.length === 1 ? "" : "s"}.`, variant: "success" });
        return;
      }
      case "run_workflow":
        runWorkflow?.();
        return;
      case "select_tool":
        setActiveTool(action.tool as ToolId);
        return;
      case "delete_selection":
        if (selectedIds.length > 0) {
          createCheckpoint("Before delete");
          removeElements(selectedIds);
        }
        return;
      case "duplicate_selection":
        duplicateSelection();
        return;
      case "rename_selection":
        if (selectedIds.length === 1) renameElement(selectedIds[0], action.name);
        return;
      case "create_checkpoint":
        createCheckpoint(action.name);
        addToast({ title: "Checkpoint saved", message: action.name, variant: "success" });
        return;
      case "restore_checkpoint": {
        const checkpoint = conversation.checkpoints.find((item) => item.id === action.checkpointId);
        if (checkpoint) {
          createCheckpoint("Before restore");
          replaceWorkflow(checkpoint.workflow);
          addToast({ title: "Checkpoint restored", message: checkpoint.name, variant: "success" });
        }
      }
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || loading || conversation.archived) return;

    const userMessage: AgentMessage = {
      id: uid(),
      role: "user",
      content: prompt.trim(),
      createdAt: new Date().toISOString(),
    };
    const nextMessages = [...conversation.messages, userMessage];
    setPrompt("");
    appendMessages([userMessage]);
    setLoading(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userMessage.content,
          messages: conversation.messages,
          appState: {
            projectName,
            workflow,
            selectedIds,
            activeTool,
            checkpoints: conversation.checkpoints,
          },
        }),
      });
      const json: AgentResponse & { error?: string } = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Agent failed");

      const assistantMessage: AgentMessage = {
        id: uid(),
        role: "assistant",
        content: json.message,
        createdAt: new Date().toISOString(),
      };
      setConversation((prev) => ({
        ...prev,
        messages: [...nextMessages, assistantMessage],
      }));
      for (const action of json.actions ?? []) {
        await executeAction(action);
      }
    } catch (err) {
      addToast({
        title: "Agent error",
        message: err instanceof Error ? err.message : "Could not run agent",
        variant: "error",
      });
      setConversation((prev) => ({ ...prev, messages: nextMessages }));
    } finally {
      setLoading(false);
    }
  }

  function renameConversation() {
    const title = window.prompt("Rename agent session", conversation.title)?.trim();
    if (title) updateConversation({ title });
  }

  function editMessage(message: AgentMessage) {
    const content = window.prompt("Edit message", message.content)?.trim();
    if (!content) return;
    setConversation((prev) => ({
      ...prev,
      messages: prev.messages.map((item) =>
        item.id === message.id ? { ...item, content } : item
      ),
    }));
  }

  function restoreCheckpoint(checkpoint: CanvasCheckpoint) {
    createCheckpoint("Before restore");
    replaceWorkflow(checkpoint.workflow);
    addToast({ title: "Checkpoint restored", message: checkpoint.name, variant: "success" });
  }

  if (!open) {
    return (
      <div className="fixed bottom-5 left-1/2 z-50 w-[min(560px,calc(100vw-32px))] -translate-x-1/2">
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left shadow-xl shadow-black/10 transition-colors hover:border-neutral-900"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-neutral-900">OpenCreative Agent</p>
            <p className="truncate text-xs text-neutral-500">Ask it to build, edit, run, or checkpoint this canvas</p>
          </div>
          <MessageSquare className="size-4 shrink-0 text-neutral-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-5 left-1/2 z-50 max-h-[min(720px,calc(100vh-40px))] w-[min(760px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl shadow-black/15">
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-neutral-900 text-white">
            <Sparkles className="size-3.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-neutral-900">OpenCreative Agent</p>
            <p className="truncate text-[11px] text-neutral-500">{projectName}</p>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          title="Collapse agent"
          className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="max-h-[calc(min(720px,100vh-40px)-57px)] overflow-y-auto p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {conversation.pinned && <Pin className="size-3 fill-neutral-900" />}
            <p className="truncate text-xs font-semibold text-neutral-800">{conversation.title}</p>
          </div>
          <p className="text-[10px] text-neutral-400">
            {conversation.archived ? "Archived session" : `${conversation.messages.length} message${conversation.messages.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <button onClick={() => updateConversation({ pinned: !conversation.pinned })} title={conversation.pinned ? "Unpin session" : "Pin session"} className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900">
            <Pin className={`size-3.5 ${conversation.pinned ? "fill-neutral-900 text-neutral-900" : ""}`} />
          </button>
          <button onClick={renameConversation} title="Rename session" className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900">
            <Pencil className="size-3.5" />
          </button>
          <button onClick={() => updateConversation({ archived: !conversation.archived })} title={conversation.archived ? "Restore session" : "Archive session"} className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900">
            {conversation.archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
          </button>
          <button onClick={() => setConversation(emptyConversation)} title="Delete session" className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="mb-2 max-h-52 space-y-2 overflow-y-auto rounded-md border border-neutral-200 bg-white p-2">
        {conversation.messages.length === 0 ? (
          <div className="py-4 text-center">
            <Sparkles className="mx-auto mb-2 size-5 text-neutral-300" />
            <p className="text-[11px] text-neutral-400">Ask the agent to build, edit, run, or checkpoint the workflow.</p>
          </div>
        ) : (
          conversation.messages.map((message) => (
            <div key={message.id} className={`rounded-md px-2 py-1.5 text-[11px] ${message.role === "user" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700"}`}>
              <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
              <div className="mt-1 flex justify-end gap-1 opacity-70">
                <button
                  onClick={() => navigator.clipboard?.writeText(message.content)}
                  title="Copy message"
                  className="rounded p-0.5 hover:bg-white/20"
                >
                  <Clipboard className="size-3" />
                </button>
                {message.role === "user" && (
                  <button onClick={() => editMessage(message)} title="Edit message" className="rounded p-0.5 hover:bg-white/20">
                    <Pencil className="size-3" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-2">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={conversation.archived}
          placeholder={conversation.archived ? "Restore the session to continue" : "Ask the agent to create nodes, run the workflow, rename selected layers, or save a checkpoint"}
          rows={3}
          className="w-full resize-none rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-xs outline-none transition-colors focus:border-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-400"
        />
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => createCheckpoint("Manual checkpoint")}
            className="flex items-center justify-center gap-1.5 rounded-md border border-neutral-200 px-2 py-1.5 text-[11px] font-medium text-neutral-600 hover:bg-neutral-100"
          >
            <History className="size-3.5" />
            Checkpoint
          </button>
          <button
            type="button"
            onClick={() => runWorkflow?.()}
            className="flex items-center justify-center gap-1.5 rounded-md border border-neutral-200 px-2 py-1.5 text-[11px] font-medium text-neutral-600 hover:bg-neutral-100"
          >
            <Play className="size-3.5" />
            Run
          </button>
        </div>
        <button
          type="submit"
          disabled={loading || !prompt.trim() || conversation.archived}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          {loading ? "Working..." : "Run agent"}
        </button>
      </form>

      {conversation.checkpoints.length > 0 && (
        <div className="mt-3 border-t border-neutral-100 pt-2">
          <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-neutral-500">
            <History className="size-3.5" />
            Checkpoints
          </div>
          <div className="space-y-1">
            {conversation.checkpoints.slice(0, 5).map((checkpoint) => (
              <div key={checkpoint.id} className="flex items-center gap-1 rounded-md px-1 py-1 text-[11px] text-neutral-600 hover:bg-neutral-100">
                <span className="min-w-0 flex-1 truncate">{checkpoint.name}</span>
                <button onClick={() => restoreCheckpoint(checkpoint)} title="Restore checkpoint" className="rounded p-1 text-neutral-400 hover:text-neutral-900">
                  <RotateCcw className="size-3" />
                </button>
                <button
                  onClick={() =>
                    setConversation((prev) => ({
                      ...prev,
                      checkpoints: prev.checkpoints.filter((item) => item.id !== checkpoint.id),
                    }))
                  }
                  title="Delete checkpoint"
                  className="rounded p-1 text-neutral-400 hover:text-red-600"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
