"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Command } from "lucide-react";
import { useCommandPalette } from "@/lib/command-palette/context";

export function CommandPalette() {
  const { open, setOpen, query, setQuery, commands } = useCommandPalette();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      inputRef.current?.focus();
    }
  }, [open, setQuery]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.subtitle?.toLowerCase().includes(q) ||
        c.section?.toLowerCase().includes(q)
    );
  }, [commands, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const cmd of filtered) {
      const section = cmd.section || "Actions";
      if (!map.has(section)) map.set(section, []);
      map.get(section)!.push(cmd);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const flatCommands = useMemo(() => filtered, [filtered]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % flatCommands.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + flatCommands.length) % flatCommands.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cmd = flatCommands[selectedIndex];
        if (cmd) {
          cmd.onSelect();
          setOpen(false);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flatCommands, selectedIndex, setOpen]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/30 pt-[20vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3">
          <Search className="size-4 text-neutral-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands…"
            className="flex-1 bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
          />
          <div className="flex items-center gap-1 rounded border border-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-400">
            <Command className="size-3" />
            <span>K</span>
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto py-2">
          {flatCommands.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-neutral-400">
              No commands found
            </p>
          ) : (
            grouped.map(([section, cmds]) => (
              <div key={section}>
                <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  {section}
                </div>
                {cmds.map((cmd) => {
                  const flatIndex = flatCommands.findIndex((c) => c.id === cmd.id);
                  const isSelected = flatIndex === selectedIndex;
                  return (
                    <button
                      key={cmd.id}
                      onMouseEnter={() => setSelectedIndex(flatIndex)}
                      onClick={() => {
                        cmd.onSelect();
                        setOpen(false);
                      }}
                      className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors ${
                        isSelected ? "bg-neutral-100" : "hover:bg-neutral-50"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {cmd.icon}
                        <span className="text-neutral-700">{cmd.title}</span>
                        {cmd.subtitle && (
                          <span className="text-[10px] text-neutral-400">{cmd.subtitle}</span>
                        )}
                      </span>
                      {cmd.shortcut && (
                        <span className="text-[10px] text-neutral-400">{cmd.shortcut}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
