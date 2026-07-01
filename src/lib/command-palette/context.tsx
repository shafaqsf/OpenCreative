"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  register: (commands: Command[]) => () => void;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [commands, setCommands] = useState<Command[]>([]);

  const register = useCallback((next: Command[]) => {
    setCommands((prev) => {
      const existing = new Set(prev.map((c) => c.id));
      const toAdd = next.filter((c) => !existing.has(c.id));
      return [...prev, ...toAdd];
    });
    return () => {
      const ids = new Set(next.map((c) => c.id));
      setCommands((prev) => prev.filter((c) => !ids.has(c.id)));
    };
  }, []);

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
    () => ({ open, setOpen, query, setQuery, commands, register }),
    [open, query, commands, register]
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
  const { register } = useCommandPalette();
  useEffect(() => {
    return register(commands);
  }, [commands, register]);
}
