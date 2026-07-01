"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type Command = {
  id: string;
  title: string;
  subtitle?: string;
  shortcut?: string;
  icon?: React.ReactNode;
  section?: string;
  onSelect: () => void;
};

type CommandPaletteContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  query: string;
  setQuery: (query: string) => void;
  commands: Command[];
  register: (id: string, commands: Command[]) => void;
  unregister: (id: string) => void;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

function commandIdsEqual(a: Command[], b: Command[]) {
  if (a.length !== b.length) return false;
  return a.every((cmd, i) => cmd.id === b[i].id);
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [commandMap, setCommandMap] = useState<Map<string, Command[]>>(new Map());

  const register = useCallback((id: string, commands: Command[]) => {
    setCommandMap((prev) => {
      const existing = prev.get(id);
      if (existing && commandIdsEqual(existing, commands)) return prev;
      const next = new Map(prev);
      next.set(id, commands);
      return next;
    });
  }, []);

  const unregister = useCallback((id: string) => {
    setCommandMap((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const commands = useMemo(
    () => Array.from(commandMap.values()).flat(),
    [commandMap]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo(
    () => ({ open, setOpen, query, setQuery, commands, register, unregister }),
    [open, query, commands, register, unregister]
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx)
    throw new Error("useCommandPalette must be used within <CommandPaletteProvider>");
  return ctx;
}

export function useRegisterCommands(commands: Command[]) {
  const { register, unregister } = useCommandPalette();
  const id = useId();
  const idsRef = useRef("");

  useEffect(() => {
    const ids = commands.map((c) => c.id).join(",");
    if (ids === idsRef.current) return;
    idsRef.current = ids;
    register(id, commands);
  }, [commands, id, register]);

  useEffect(() => {
    return () => {
      unregister(id);
    };
  }, [id, unregister]);
}
