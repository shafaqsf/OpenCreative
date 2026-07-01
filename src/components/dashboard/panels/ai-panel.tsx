"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ChevronUp,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { newNode, uid, useCanvas } from "@/lib/canvas/context";
import { useToast } from "@/lib/toast/context";
import type { AgentAction, AgentMessage, AgentResponse } from "@/types/agent";
import type { NodeType, ToolId, WorkflowState } from "@/types/canvas";

type ChatState = {
  id: string;
  title: string;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  messages: AgentMessage[];
};

type AgentStore = {
  activeChatId: string;
  chats: ChatState[];
};

function newChat(title = "New chat"): ChatState {
  const now = new Date().toISOString();
  return {
    id: uid(),
    title,
    pinned: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

function createInitialStore(): AgentStore {
  const chat = newChat("Canvas agent");
  return { activeChatId: chat.id, chats: [chat] };
}

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
    addElements,
    removeElements,
    duplicateSelection,
    renameElement,
    runWorkflow,
    setActiveTool,
  } = useCanvas();
  const { addToast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [store, setStore] = useState<AgentStore>(() => createInitialStore());

  const storageKey = `opencreative:agent:${projectId}`;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.chats) && parsed.chats.length > 0) {
        setStore(parsed);
        return;
      }
      if (Array.isArray(parsed.messages)) {
        const migrated = newChat(parsed.title || "Canvas agent");
        migrated.pinned = Boolean(parsed.pinned);
        migrated.archived = Boolean(parsed.archived);
        migrated.messages = parsed.messages;
        setStore({ activeChatId: migrated.id, chats: [migrated] });
      }
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(store));
    } catch {
      addToast({
        title: "Storage limit reached",
        message: "Chat history is too large. Archive or delete old chats to continue saving.",
        variant: "warning",
      });
    }
  }, [storageKey, store, addToast]);

  const workflow = useMemo<WorkflowState>(
    () => ({ elements, connections, camera }),
    [elements, connections, camera]
  );

  const activeChat = useMemo(() => {
    return store.chats.find((chat) => chat.id === store.activeChatId) ?? store.chats[0];
  }, [store]);

  const visibleChats = useMemo(() => {
    return [...store.chats]
      .filter((chat) => chat.archived === showArchived)
      .sort((a, b) => {
        const pinDelta = Number(b.pinned) - Number(a.pinned);
        if (pinDelta !== 0) return pinDelta;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [store.chats, showArchived]);

  function updateChat(chatId: string, patch: Partial<ChatState>) {
    setStore((prev) => ({
      ...prev,
      chats: prev.chats.map((chat) =>
        chat.id === chatId ? { ...chat, ...patch, updatedAt: new Date().toISOString() } : chat
      ),
    }));
  }

  function createChat() {
    const chat = newChat();
    setStore((prev) => ({
      activeChatId: chat.id,
      chats: [chat, ...prev.chats],
    }));
    setTranscriptOpen(false);
    setMenuOpen(false);
  }

  function deleteChat(chatId: string) {
    setStore((prev) => {
      const chats = prev.chats.filter((chat) => chat.id !== chatId);
      if (chats.length === 0) return createInitialStore();
      return {
        activeChatId: prev.activeChatId === chatId ? chats[0].id : prev.activeChatId,
        chats,
      };
    });
  }

  function renameChat(chat: ChatState) {
    const title = window.prompt("Rename chat", chat.title)?.trim();
    if (title) updateChat(chat.id, { title });
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
        const createdConnections = (action.connections ?? []).flatMap((connection) => {
          const from = created[connection.from];
          const to = created[connection.to];
          return from && to ? [{ id: uid(), fromId: from.id, toId: to.id }] : [];
        });
        addElements(created, createdConnections);
        addToast({
          title: "Agent updated canvas",
          message: `Created ${created.length} node${created.length === 1 ? "" : "s"}.`,
          variant: "success",
        });
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
          removeElements(selectedIds);
        }
        return;
      case "duplicate_selection":
        duplicateSelection();
        return;
      case "rename_selection":
        if (selectedIds.length === 1) renameElement(selectedIds[0], action.name);
        return;
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeChat || !prompt.trim() || loading || activeChat.archived) return;

    const userMessage: AgentMessage = {
      id: uid(),
      role: "user",
      content: prompt.trim(),
      createdAt: new Date().toISOString(),
    };
    const messages = [...activeChat.messages, userMessage];
    setPrompt("");
    setTranscriptOpen(true);
    updateChat(activeChat.id, { messages });
    setLoading(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userMessage.content,
          messages: activeChat.messages,
          appState: {
            projectName,
            workflow,
            selectedIds,
            activeTool,
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
      updateChat(activeChat.id, { messages: [...messages, assistantMessage] });
      for (const action of json.actions ?? []) {
        await executeAction(action);
      }
    } catch (err) {
      addToast({
        title: "Agent error",
        message: err instanceof Error ? err.message : "Could not run agent",
        variant: "error",
      });
      updateChat(activeChat.id, { messages });
    } finally {
      setLoading(false);
    }
  }

  if (!activeChat) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-50 w-[min(760px,calc(100vw-32px))] -translate-x-1/2">
      {transcriptOpen && (
        <div className="mb-3 max-h-[48vh] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl shadow-black/15">
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              {activeChat.pinned && <Pin className="size-3.5 fill-neutral-900" />}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-neutral-900">{activeChat.title}</p>
                <p className="truncate text-[11px] text-neutral-500">{projectName}</p>
              </div>
            </div>
            <button
              onClick={() => setTranscriptOpen(false)}
              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
              title="Close transcript"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="max-h-[34vh] space-y-3 overflow-y-auto p-4">
            {activeChat.messages.length === 0 ? (
              <div className="py-8 text-center">
                <Sparkles className="mx-auto mb-2 size-5 text-neutral-300" />
                <p className="text-sm text-neutral-500">Start by asking the agent to operate this canvas.</p>
              </div>
            ) : (
              activeChat.messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "ml-auto bg-neutral-900 text-white"
                      : "bg-neutral-100 text-neutral-800"
                  }`}
                >
                  {message.content}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {menuOpen && (
        <div className="absolute bottom-full left-0 mb-3 w-80 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl shadow-black/15">
          <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
            <div className="flex rounded-lg border border-neutral-200 bg-white p-0.5">
              <button
                onClick={() => setShowArchived(false)}
                className={`rounded-md px-2 py-1 text-xs ${!showArchived ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100"}`}
              >
                Active
              </button>
              <button
                onClick={() => setShowArchived(true)}
                className={`rounded-md px-2 py-1 text-xs ${showArchived ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100"}`}
              >
                Archived
              </button>
            </div>
            <button
              onClick={createChat}
              className="flex items-center gap-1.5 rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium text-white"
            >
              <Plus className="size-3.5" />
              New
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto p-1">
            {visibleChats.length === 0 ? (
              <div className="px-3 py-8 text-center text-xs text-neutral-400">No chats here.</div>
            ) : (
              visibleChats.map((chat) => (
                <div
                  key={chat.id}
                  className={`group flex items-center gap-1 rounded-lg p-1 ${
                    chat.id === activeChat.id ? "bg-neutral-100" : "hover:bg-neutral-50"
                  }`}
                >
                  <button
                    onClick={() => {
                      setStore((prev) => ({ ...prev, activeChatId: chat.id }));
                      setMenuOpen(false);
                      setTranscriptOpen(chat.messages.length > 0);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
                  >
                    {chat.pinned ? <Pin className="size-3.5 fill-neutral-900" /> : <MessageSquare className="size-3.5 text-neutral-400" />}
                    <span className="truncate text-xs text-neutral-800">{chat.title}</span>
                  </button>
                  <button
                    onClick={() => updateChat(chat.id, { pinned: !chat.pinned })}
                    className="rounded p-1 text-neutral-400 opacity-0 hover:text-neutral-900 group-hover:opacity-100"
                    title={chat.pinned ? "Unpin chat" : "Pin chat"}
                  >
                    <Pin className={`size-3.5 ${chat.pinned ? "fill-neutral-900 text-neutral-900" : ""}`} />
                  </button>
                  <button
                    onClick={() => renameChat(chat)}
                    className="rounded p-1 text-neutral-400 opacity-0 hover:text-neutral-900 group-hover:opacity-100"
                    title="Rename chat"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={() => updateChat(chat.id, { archived: !chat.archived, pinned: false })}
                    className="rounded p-1 text-neutral-400 opacity-0 hover:text-neutral-900 group-hover:opacity-100"
                    title={chat.archived ? "Restore chat" : "Archive chat"}
                  >
                    {chat.archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
                  </button>
                  <button
                    onClick={() => deleteChat(chat.id)}
                    className="rounded p-1 text-neutral-400 opacity-0 hover:text-red-600 group-hover:opacity-100"
                    title="Delete chat"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <form
        onSubmit={submit}
        className="flex items-end gap-2 rounded-2xl border border-neutral-200 bg-white p-2 shadow-2xl shadow-black/15"
      >
        <button
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          title="Chats"
        >
          <MessageSquare className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => setTranscriptOpen((value) => !value)}
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          title="Transcript"
        >
          <ChevronUp className={`size-5 transition-transform ${transcriptOpen ? "rotate-180" : ""}`} />
        </button>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          disabled={activeChat.archived}
          placeholder={activeChat.archived ? "Restore this chat to continue" : "Ask OpenCreative Agent to build or change the workflow..."}
          rows={1}
          className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-1 py-2.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 disabled:text-neutral-400"
        />
        <button
          type="submit"
          disabled={loading || !prompt.trim() || activeChat.archived}
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white transition-colors hover:bg-neutral-800 disabled:opacity-40"
          title="Send"
        >
          {loading ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
        </button>
      </form>
    </div>
  );
}
