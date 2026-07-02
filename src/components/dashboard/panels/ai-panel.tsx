"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Archive,
  ArchiveRestore,
  Check,
  ChevronUp,
  Loader2,
  MessageSquare,
  Pencil,
  Pin,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { newElement, newNode, uid, useCanvas } from "@/lib/canvas/context";
import { useToast } from "@/lib/toast/context";
import type { AgentAction, AgentMessage, AgentResponse } from "@/types/agent";
import type { ToolId } from "@/types/canvas";
import {
  listAgentChats,
  createAgentChat,
  updateAgentChat,
  deleteAgentChat,
  listAgentMessages,
  createAgentMessage,
} from "@/lib/projects/client-service";
import { cloneElements } from "@/lib/canvas/clone";
import { canConnectNodes } from "@/lib/canvas/workflow-engine";
import type { CanvasElement, Connection } from "@/types/canvas";

type LocalChat = {
  id: string;
  title: string;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

function createLocalChat(title = "New chat"): LocalChat {
  const now = new Date().toISOString();
  return {
    id: uid(),
    title,
    pinned: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
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
    snapToGrid,
    showGrid,
    runWorkflow,
    setActiveTool,
    setCamera,
    commitWorkflowGraph,
  } = useCanvas();

  const { addToast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [chats, setChats] = useState<LocalChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messagesMap, setMessagesMap] = useState<Record<string, AgentMessage[]>>({});
  const [storeLoading, setStoreLoading] = useState(true);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const isLocal = projectId === "local";
  const localStorageKey = `opencreative:agent:${projectId}`;

  // Hydrate chats
  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (isLocal) {
        try {
          const raw = window.localStorage.getItem(localStorageKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.chats) && parsed.chats.length > 0) {
              setChats(parsed.chats);
              setActiveChatId(parsed.activeChatId ?? parsed.chats[0].id);
              if (parsed.messagesMap) setMessagesMap(parsed.messagesMap);
              if (parsed.messagesMap?.[parsed.activeChatId]?.length > 0) {
                setTranscriptOpen(true);
              }
            } else {
              const chat = createLocalChat("Canvas agent");
              setChats([chat]);
              setActiveChatId(chat.id);
            }
          } else {
            const chat = createLocalChat("Canvas agent");
            setChats([chat]);
            setActiveChatId(chat.id);
          }
        } catch {}
        setStoreLoading(false);
        return;
      }

      try {
        const dbChats = await listAgentChats(projectId);
        if (cancelled) return;
        if (dbChats.length > 0) {
          const localChats = dbChats.map((c) => ({
            id: c.id,
            title: c.title,
            pinned: c.pinned,
            archived: c.archived,
            createdAt: c.created_at,
            updatedAt: c.updated_at,
          }));
          setChats(localChats);
          const first = localChats[0];
          setActiveChatId(first.id);
          const msgs = await listAgentMessages(first.id);
          if (cancelled) return;
          setMessagesMap((prev) => ({
            ...prev,
            [first.id]: msgs.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              createdAt: m.created_at,
            })),
          }));
          if (msgs.length > 0) setTranscriptOpen(true);
        } else {
          const chat = await createAgentChat(projectId, "Canvas agent");
          if (cancelled) return;
          const localChat = {
            id: chat.id,
            title: chat.title,
            pinned: chat.pinned,
            archived: chat.archived,
            createdAt: chat.created_at,
            updatedAt: chat.updated_at,
          };
          setChats([localChat]);
          setActiveChatId(localChat.id);
        }
      } catch (err) {
        if (cancelled) return;
        addToast({
          title: "Chat load failed",
          message: err instanceof Error ? err.message : "Could not load chats.",
          variant: "error",
        });
        const chat = createLocalChat("Canvas agent");
        setChats([chat]);
        setActiveChatId(chat.id);
      } finally {
        if (!cancelled) setStoreLoading(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [projectId, isLocal, localStorageKey, addToast]);

  // Persist local fallback
  useEffect(() => {
    if (!isLocal || storeLoading) return;
    try {
      window.localStorage.setItem(
        localStorageKey,
        JSON.stringify({ activeChatId, chats, messagesMap })
      );
    } catch {
      addToast({
        title: "Storage limit reached",
        message: "Chat history is too large. Archive or delete old chats to continue saving.",
        variant: "warning",
      });
    }
  }, [isLocal, localStorageKey, activeChatId, chats, messagesMap, storeLoading, addToast]);

  const loadedChatIdsRef = useRef<Set<string>>(new Set());

  // Load messages when active chat changes (DB only)
  useEffect(() => {
    const chatId = activeChatId;
    if (!chatId || isLocal || storeLoading) return;
    if (loadedChatIdsRef.current.has(chatId)) return;
    let cancelled = false;
    async function load(id: string) {
      try {
        const msgs = await listAgentMessages(id);
        if (cancelled) return;
        loadedChatIdsRef.current.add(id);
        setMessagesMap((prev) => ({
          ...prev,
          [id]: msgs.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.created_at,
          })),
        }));
      } catch (err) {
        if (cancelled) return;
        addToast({
          title: "Load messages failed",
          message: err instanceof Error ? err.message : "Could not load chat messages.",
          variant: "error",
        });
      }
    }
    load(chatId);
    return () => {
      cancelled = true;
    };
  }, [activeChatId, isLocal, storeLoading, addToast]);

  const activeChat = useMemo(() => {
    return chats.find((c) => c.id === activeChatId) ?? chats[0] ?? null;
  }, [chats, activeChatId]);

  const activeMessages = useMemo(() => {
    return activeChat ? (messagesMap[activeChat.id] ?? []) : [];
  }, [activeChat, messagesMap]);

  const visibleChats = useMemo(() => {
    return [...chats]
      .filter((chat) => chat.archived === showArchived)
      .sort((a, b) => {
        const pinDelta = Number(b.pinned) - Number(a.pinned);
        if (pinDelta !== 0) return pinDelta;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [chats, showArchived]);

  const updateLocalChat = useCallback((chatId: string, patch: Partial<LocalChat>) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId ? { ...chat, ...patch, updatedAt: new Date().toISOString() } : chat
      )
    );
  }, []);

  async function createChat() {
    if (isLocal) {
      const chat = createLocalChat();
      setChats((prev) => [chat, ...prev]);
      setActiveChatId(chat.id);
      setTranscriptOpen(false);
      setMenuOpen(false);
      return;
    }
    try {
      const chat = await createAgentChat(projectId);
      const localChat = {
        id: chat.id,
        title: chat.title,
        pinned: chat.pinned,
        archived: chat.archived,
        createdAt: chat.created_at,
        updatedAt: chat.updated_at,
      };
      setChats((prev) => [localChat, ...prev]);
      setActiveChatId(localChat.id);
      setTranscriptOpen(false);
      setMenuOpen(false);
    } catch (err) {
      addToast({
        title: "Create chat failed",
        message: err instanceof Error ? err.message : "Could not create chat.",
        variant: "error",
      });
    }
  }

  async function handleDeleteChat(chatId: string) {
    if (!isLocal) {
      try {
        await deleteAgentChat(chatId);
      } catch (err) {
        addToast({
          title: "Delete chat failed",
          message: err instanceof Error ? err.message : "Could not delete chat.",
          variant: "error",
        });
        return;
      }
    }
    const remaining = chats.filter((c) => c.id !== chatId);
    if (remaining.length === 0) {
      if (isLocal) {
        const fresh = createLocalChat("Canvas agent");
        setChats([fresh]);
        setActiveChatId(fresh.id);
      } else {
        try {
          const chat = await createAgentChat(projectId, "Canvas agent");
          const localChat = {
            id: chat.id,
            title: chat.title,
            pinned: chat.pinned,
            archived: chat.archived,
            createdAt: chat.created_at,
            updatedAt: chat.updated_at,
          };
          setChats([localChat]);
          setActiveChatId(localChat.id);
        } catch (err) {
          addToast({
            title: "Delete chat failed",
            message: err instanceof Error ? err.message : "Could not delete chat.",
            variant: "error",
          });
        }
      }
    } else {
      setChats(remaining);
      if (activeChatId === chatId) setActiveChatId(remaining[0].id);
    }
  }

  async function handleUpdateChat(
    chatId: string,
    patch: Partial<Pick<LocalChat, "title" | "pinned" | "archived">>
  ) {
    const localPatch: Partial<LocalChat> = { ...patch };
    if (patch.archived === true) localPatch.pinned = false;
    updateLocalChat(chatId, localPatch);
    if (isLocal) return;
    try {
      await updateAgentChat(chatId, patch);
    } catch (err) {
      addToast({
        title: "Update chat failed",
        message: err instanceof Error ? err.message : "Could not update chat.",
        variant: "error",
      });
    }
  }

  function startRenameChat(chat: LocalChat) {
    setEditingChatId(chat.id);
    setRenameDraft(chat.title);
  }

  function cancelRenameChat() {
    setEditingChatId(null);
    setRenameDraft("");
  }

  function commitRenameChat(chat: LocalChat) {
    const title = renameDraft.trim();
    if (title && title !== chat.title) {
      handleUpdateChat(chat.id, { title });
    }
    cancelRenameChat();
  }

  function cloneGraphElements(source: CanvasElement[]): CanvasElement[] {
    return source.map((el) => {
      const clone: CanvasElement = {
        ...el,
        points: el.points?.map((point) => ({ ...point })),
        nodeData: el.nodeData
          ? {
              ...el.nodeData,
              properties: { ...el.nodeData.properties },
              outputUrls: el.nodeData.outputUrls ? [...el.nodeData.outputUrls] : undefined,
            }
          : undefined,
      };
      return clone;
    });
  }

  function applyAgentActions(actions: AgentAction[]) {
    let nextElements = cloneGraphElements(elements);
    let nextConnections: Connection[] = connections.map((connection) => ({ ...connection }));
    let graphChanged = false;
    let shouldRunWorkflow = false;
    let createdNodes = 0;
    let createdAnnotations = 0;
    let movedNodes = 0;
    let addedConnections = 0;
    let updatedNodes = 0;
    let deletedItems = 0;
    let duplicatedItems = 0;
    let renamedItems = 0;

    const selectedSet = new Set(selectedIds);

    for (const action of actions) {
      switch (action.type) {
        case "create_nodes": {
          const created = action.nodes.map((node) => {
            const el = newNode(node.type, node.x, node.y);
            el.nodeData!.properties = {
              ...el.nodeData!.properties,
              ...(node.properties ?? {}),
            };
            return el;
          });
          nextElements = [...nextElements, ...created];
          createdNodes += created.length;
          graphChanged = graphChanged || created.length > 0;

          for (const connection of action.connections ?? []) {
            const from = created[connection.from];
            const to = created[connection.to];
            if (!from || !to) continue;
            if (!canConnectNodes(nextElements, nextConnections, from.id, to.id).ok) continue;
            nextConnections = [...nextConnections, { id: uid(), fromId: from.id, toId: to.id }];
            addedConnections++;
            graphChanged = true;
          }
          break;
        }
        case "move_nodes": {
          let moved = 0;
          nextElements = nextElements.map((el) => {
            const update = action.nodes.find((node) => node.id === el.id);
            if (!update) return el;
            moved++;
            if (el.points) {
              const dx = update.x - el.x;
              const dy = update.y - el.y;
              return {
                ...el,
                x: update.x,
                y: update.y,
                points: el.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
              };
            }
            return { ...el, x: update.x, y: update.y };
          });
          movedNodes += moved;
          graphChanged = graphChanged || moved > 0;
          break;
        }
        case "connect_nodes": {
          for (const connection of action.connections) {
            if (!canConnectNodes(nextElements, nextConnections, connection.fromId, connection.toId).ok) continue;
            nextConnections = [
              ...nextConnections,
              { id: uid(), fromId: connection.fromId, toId: connection.toId },
            ];
            addedConnections++;
            graphChanged = true;
          }
          break;
        }
        case "update_node_properties": {
          let updated = 0;
          nextElements = nextElements.map((el) => {
            if (el.id !== action.id || !el.nodeData) return el;
            updated++;
            return {
              ...el,
              nodeData: {
                ...el.nodeData,
                properties: action.properties,
              },
            };
          });
          updatedNodes += updated;
          graphChanged = graphChanged || updated > 0;
          break;
        }
        case "set_camera":
          setCamera({ x: action.x, y: action.y, zoom: action.zoom });
          break;
        case "create_annotations": {
          const created = action.annotations.map((ann) => {
            const el = newElement(ann.type, ann.x, ann.y);
            el.width = ann.width ?? (ann.type === "text" ? 160 : 120);
            el.height = ann.height ?? (ann.type === "text" ? 40 : 80);
            if (ann.text) el.text = ann.text;
            return el;
          });
          nextElements = [...nextElements, ...created];
          createdAnnotations += created.length;
          graphChanged = graphChanged || created.length > 0;
          break;
        }
        case "run_workflow":
          shouldRunWorkflow = true;
          break;
        case "select_tool":
          setActiveTool(action.tool as ToolId);
          break;
        case "delete_selection": {
          if (selectedSet.size === 0) break;
          const before = nextElements.length;
          nextElements = nextElements.filter((el) => !selectedSet.has(el.id));
          nextConnections = nextConnections.filter(
            (connection) => !selectedSet.has(connection.fromId) && !selectedSet.has(connection.toId)
          );
          deletedItems += before - nextElements.length;
          graphChanged = graphChanged || before !== nextElements.length;
          break;
        }
        case "duplicate_selection": {
          if (selectedSet.size === 0) break;
          const idMap = new Map<string, string>();
          const clones = cloneElements(
            nextElements.filter((el) => selectedSet.has(el.id)),
            20,
            20,
            idMap
          );
          nextElements = [...nextElements, ...clones];
          duplicatedItems += clones.length;
          graphChanged = graphChanged || clones.length > 0;
          break;
        }
        case "rename_selection": {
          if (selectedIds.length !== 1) break;
          const id = selectedIds[0];
          let renamed = 0;
          nextElements = nextElements.map((el) => {
            if (el.id !== id) return el;
            renamed++;
            return { ...el, customLabel: action.name };
          });
          renamedItems += renamed;
          graphChanged = graphChanged || renamed > 0;
          break;
        }
      }
    }

    if (graphChanged) {
      commitWorkflowGraph(nextElements, nextConnections);
    }

    const summary: string[] = [];
    if (createdNodes > 0) summary.push(`${createdNodes} node${createdNodes === 1 ? "" : "s"}`);
    if (createdAnnotations > 0) summary.push(`${createdAnnotations} annotation${createdAnnotations === 1 ? "" : "s"}`);
    if (movedNodes > 0) summary.push(`${movedNodes} moved`);
    if (addedConnections > 0) summary.push(`${addedConnections} connection${addedConnections === 1 ? "" : "s"}`);
    if (updatedNodes > 0) summary.push(`${updatedNodes} updated`);
    if (deletedItems > 0) summary.push(`${deletedItems} deleted`);
    if (duplicatedItems > 0) summary.push(`${duplicatedItems} duplicated`);
    if (renamedItems > 0) summary.push(`${renamedItems} renamed`);

    if (summary.length > 0) {
      addToast({
        title: "Agent updated canvas",
        message: summary.join(", "),
        variant: "success",
        duration: 2500,
      });
    }

    if (shouldRunWorkflow) {
      window.setTimeout(() => runWorkflow?.(), 0);
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

    // Optimistically add user message
    const nextMessages = [...activeMessages, userMessage];
    setMessagesMap((prev) => ({ ...prev, [activeChat.id]: nextMessages }));
    setPrompt("");
    setTranscriptOpen(true);
    setLoading(true);

    // Persist user message in background
    if (!isLocal) {
      createAgentMessage(activeChat.id, userMessage.role, userMessage.content).catch((err) => {
        addToast({ title: "Save message failed", message: err instanceof Error ? err.message : "", variant: "error" });
      });
    }

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userMessage.content,
          messages: nextMessages,
          appState: {
            projectName,
            workflow: { elements, connections, camera, ui: { snapToGrid, showGrid } },
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

      // Persist assistant message
      let assistantDbId: string | null = null;
      if (!isLocal) {
        try {
          const dbMsg = await createAgentMessage(activeChat.id, assistantMessage.role, assistantMessage.content);
          assistantDbId = dbMsg.id;
        } catch (err) {
          addToast({ title: "Save message failed", message: err instanceof Error ? err.message : "", variant: "error" });
        }
      }

      // Update local messages (replace local id with db id if available)
      const finalMessages = [
        ...nextMessages,
        assistantDbId ? { ...assistantMessage, id: assistantDbId } : assistantMessage,
      ];
      setMessagesMap((prev) => ({ ...prev, [activeChat.id]: finalMessages }));

      applyAgentActions(json.actions ?? []);
    } catch (err) {
      addToast({
        title: "Agent error",
        message: err instanceof Error ? err.message : "Could not run agent",
        variant: "error",
      });
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
            {activeMessages.length === 0 ? (
              <div className="py-8 text-center">
                <Sparkles className="mx-auto mb-2 size-5 text-neutral-300" />
                <p className="text-sm text-neutral-500">Start by asking the agent to operate this canvas.</p>
              </div>
            ) : (
              activeMessages.map((message) => (
                <div key={message.id} className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                      message.role === "user"
                        ? "bg-neutral-900 text-white"
                        : "bg-neutral-100 text-neutral-800"
                    }`}
                  >
                    {message.content}
                  </div>
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
            {storeLoading ? (
              <div className="px-3 py-8 text-center text-xs text-neutral-400">Loading chats…</div>
            ) : visibleChats.length === 0 ? (
              <div className="px-3 py-8 text-center text-xs text-neutral-400">No chats here.</div>
            ) : (
              visibleChats.map((chat) => (
                <div
                  key={chat.id}
                  className={`group flex items-center gap-1 rounded-lg p-1 ${
                    chat.id === activeChat.id ? "bg-neutral-100" : "hover:bg-neutral-50"
                  }`}
                >
                  {editingChatId === chat.id ? (
                    <>
                      <input
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRenameChat(chat);
                          if (e.key === "Escape") cancelRenameChat();
                        }}
                        autoFocus
                        className="min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-900 outline-none focus:border-neutral-400"
                      />
                      <button
                        onClick={() => commitRenameChat(chat)}
                        className="rounded p-1 text-neutral-500 hover:text-neutral-900"
                        title="Save name"
                        aria-label="Save name"
                      >
                        <Check className="size-3.5" />
                      </button>
                      <button
                        onClick={cancelRenameChat}
                        className="rounded p-1 text-neutral-500 hover:text-neutral-900"
                        title="Cancel rename"
                        aria-label="Cancel rename"
                      >
                        <X className="size-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setActiveChatId(chat.id);
                          setMenuOpen(false);
                          setTranscriptOpen((messagesMap[chat.id] ?? []).length > 0);
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
                      >
                        {chat.pinned ? <Pin className="size-3.5 fill-neutral-900" /> : <MessageSquare className="size-3.5 text-neutral-400" />}
                        <span className="truncate text-xs text-neutral-800">{chat.title}</span>
                      </button>
                      <button
                        onClick={() => handleUpdateChat(chat.id, { pinned: !chat.pinned })}
                        className="rounded p-1 text-neutral-400 opacity-0 hover:text-neutral-900 group-hover:opacity-100"
                        title={chat.pinned ? "Unpin chat" : "Pin chat"}
                      >
                        <Pin className={`size-3.5 ${chat.pinned ? "fill-neutral-900 text-neutral-900" : ""}`} />
                      </button>
                      <button
                        onClick={() => startRenameChat(chat)}
                        className="rounded p-1 text-neutral-400 opacity-0 hover:text-neutral-900 group-hover:opacity-100"
                        title="Rename chat"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => handleUpdateChat(chat.id, { archived: !chat.archived })}
                        className="rounded p-1 text-neutral-400 opacity-0 hover:text-neutral-900 group-hover:opacity-100"
                        title={chat.archived ? "Restore chat" : "Archive chat"}
                      >
                        {chat.archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
                      </button>
                      <button
                        onClick={() => handleDeleteChat(chat.id)}
                        className="rounded p-1 text-neutral-400 opacity-0 hover:text-red-600 group-hover:opacity-100"
                        title="Delete chat"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <form
        onSubmit={submit}
        className="flex min-h-14 items-center gap-1.5 rounded-2xl border border-neutral-200 bg-white p-2 shadow-2xl shadow-black/15"
      >
        <button
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
            menuOpen
              ? "bg-neutral-900 text-white"
              : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          }`}
          title="Chats"
          aria-label="Chats"
        >
          <MessageSquare className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => setTranscriptOpen((value) => !value)}
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
            transcriptOpen
              ? "bg-neutral-100 text-neutral-950"
              : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          }`}
          title="Transcript"
          aria-label="Transcript"
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
          className="max-h-24 min-h-10 min-w-0 flex-1 resize-none overflow-hidden bg-transparent px-2 py-2.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 disabled:text-neutral-400"
        />
        <button
          type="submit"
          disabled={loading || !prompt.trim() || activeChat.archived}
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white transition-colors hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400"
          title="Send"
          aria-label="Send"
        >
          {loading ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
        </button>
      </form>
    </div>
  );
}
