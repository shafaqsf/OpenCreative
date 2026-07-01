"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

export function CreateProjectDialog({
  folderId,
  onCreate,
}: {
  folderId?: string;
  onCreate: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim());
    setName("");
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex size-8 items-center justify-center rounded-full bg-neutral-900 text-white hover:bg-neutral-800"
        title="New project"
      >
        <Plus className="size-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <form
            onSubmit={submit}
            className="w-[24rem] rounded-xl border border-neutral-200 bg-white p-5 shadow-lg"
          >
            <h3 className="text-sm font-semibold text-neutral-900">
              New project
            </h3>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              className="mt-3 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
            <p className="mt-2 text-xs text-neutral-500">
              Build your own workflow on the canvas.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim()}
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}