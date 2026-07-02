"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useToast } from "@/lib/toast/context";

export function CreateProjectDialog({
  folderId,
  onCreate,
}: {
  folderId?: string;
  onCreate: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const { addToast } = useToast();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim());
    addToast({ title: "Campaign created", message: `"${name.trim()}" is ready for editing.`, variant: "success", duration: 3000 });
    setName("");
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800"
        title="New campaign"
      >
        <Plus className="size-4" />
        New campaign
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <form
            onSubmit={submit}
            className="glass-panel-strong w-[24rem] rounded-xl p-5"
          >
            <h3 className="text-sm font-semibold text-neutral-900">
              New campaign
            </h3>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Campaign name"
              className="mt-3 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
            <p className="mt-2 text-xs text-neutral-500">
              Start with a campaign workspace, then add brief, audience, channel, creative, review, and export steps.
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
