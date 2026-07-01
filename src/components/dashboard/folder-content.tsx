"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Folder, Search, Grid3X3, List } from "lucide-react";
import type { Project } from "@/lib/projects/service";
import { CreateProjectDialog } from "./create-project-dialog";
import { PinButton, usePinnedProjects } from "./project-pins";
import { ProjectThumbnail } from "./project-thumbnail";

type SortKey = "name" | "recent" | "created";
type ViewMode = "grid" | "list";

export function FolderContent({
  folderId,
  projects,
  onCreateProject,
}: {
  folderId: string;
  projects: Project[];
  onCreateProject: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [view, setView] = useState<ViewMode>("grid");
  const { pinned, toggle } = usePinnedProjects();

  const filteredProjects = useMemo(() => {
    let result = projects.filter((p) =>
      p.name.toLowerCase().includes(query.toLowerCase())
    );
    result.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "created")
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
    result.sort((a, b) => {
      const ap = pinned.has(a.id) ? 1 : 0;
      const bp = pinned.has(b.id) ? 1 : 0;
      return bp - ap;
    });
    return result;
  }, [projects, query, sort, pinned]);

  return (
    <main className="flex-1 overflow-y-auto p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects…"
            className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-9 pr-4 text-sm outline-none transition-colors focus:border-neutral-900"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900"
          >
            <option value="recent">Recently updated</option>
            <option value="created">Recently created</option>
            <option value="name">Name</option>
          </select>
          <div className="flex rounded-lg border border-neutral-200 bg-white p-0.5">
            <button
              onClick={() => setView("grid")}
              className={`rounded p-1.5 ${
                view === "grid" ? "bg-neutral-100 text-neutral-900" : "text-neutral-400"
              }`}
            >
              <Grid3X3 className="size-4" />
            </button>
            <button
              onClick={() => setView("list")}
              className={`rounded p-1.5 ${
                view === "list" ? "bg-neutral-100 text-neutral-900" : "text-neutral-400"
              }`}
            >
              <List className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 py-16">
          <Folder className="size-8 text-neutral-300" />
          <p className="mt-3 text-sm text-neutral-500">
            {query
              ? "No projects match your search."
              : "No projects in this folder yet."}
          </p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filteredProjects.map((project) => (
            <Link
              key={project.id}
              href={`/project/${project.id}`}
              className="group relative flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white hover:border-neutral-900"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-neutral-50 p-2">
                <ProjectThumbnail
                  workflow={project.workflow}
                  className="h-full w-full"
                />
                <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <PinButton
                    projectId={project.id}
                    pinned={pinned.has(project.id)}
                    onToggle={toggle}
                  />
                </div>
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-neutral-900 line-clamp-1">
                  {project.name}
                </p>
                <p className="text-xs text-neutral-500">Canvas workflow</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredProjects.map((project) => (
            <Link
              key={project.id}
              href={`/project/${project.id}`}
              className="group flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-3 hover:border-neutral-900"
            >
              <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-neutral-50">
                <ProjectThumbnail
                  workflow={project.workflow}
                  className="h-full w-full"
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-neutral-900">
                  {project.name}
                </p>
                <p className="text-xs text-neutral-500">Canvas workflow</p>
              </div>
              <div className="opacity-0 transition-opacity group-hover:opacity-100">
                <PinButton
                  projectId={project.id}
                  pinned={pinned.has(project.id)}
                  onToggle={toggle}
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
