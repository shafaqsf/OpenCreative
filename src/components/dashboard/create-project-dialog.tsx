"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { AdType } from "@/types/ads";

const AD_TYPES: { id: AdType; label: string; description: string }[] = [
  {
    id: "ai_actor",
    label: "AI Talking Actor",
    description: "Script + actor → realistic talking-head UGC video",
  },
  {
    id: "fashion_tryon",
    label: "Fashion Try-On",
    description: "Product photo + model scene → model wearing your product",
  },
  {
    id: "product_showcase",
    label: "Product Showcase",
    description: "Product photo + prompt → actor holding/using your product",
  },
  {
    id: "hook_repurpose",
    label: "Hook Repurpose",
    description: "Reference video + new script → recreate the hook for your product",
  },
  {
    id: "text_to_video",
    label: "Text-to-Video",
    description: "Prompt + optional image → cinematic AI video",
  },
];

export function CreateProjectDialog({
  folderId,
  onCreate,
}: {
  folderId?: string;
  onCreate: (name: string, adType: AdType) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [adType, setAdType] = useState<AdType>("ai_actor");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), adType);
    setName("");
    setAdType("ai_actor");
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
            className="w-[28rem] rounded-xl border border-neutral-200 bg-white p-5 shadow-lg"
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
            <div className="mt-4 grid gap-2">
              {AD_TYPES.map((t) => (
                <label
                  key={t.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    adType === t.id
                      ? "border-neutral-900 bg-neutral-50"
                      : "border-neutral-200 hover:bg-neutral-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="adType"
                    value={t.id}
                    checked={adType === t.id}
                    onChange={() => setAdType(t.id)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-neutral-900">
                      {t.label}
                    </p>
                    <p className="text-xs text-neutral-500">{t.description}</p>
                  </div>
                </label>
              ))}
            </div>
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