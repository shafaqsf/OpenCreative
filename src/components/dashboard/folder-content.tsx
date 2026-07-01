"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, Copy, Folder, Search, Grid3X3, List, Pencil, Pin, Trash2, FolderX } from "lucide-react";
import type { Project } from "@/lib/projects/service";
import { CreateProjectDialog } from "./create-project-dialog";
import { ProjectThumbnail } from "./project-thumbnail";

type SortKey = "name" | "recent" | "created";
type ViewMode = "grid" | "list";

export function FolderContent({
  folderId,
  projects,
  onCreateProject,
  onDeleteProject,
  onArchiveProject,
  onDuplicateProject,
  onPinProject,
  onRenameProject,
  onRemoveFromFolder,
  folderName,
}: {
  folderId: string;
  projects: Project[];
  onCreateProject: (name: string) => void;
  onDeleteProject?: (id: string) => void;
  onArchiveProject?: (id: string, archived: boolean) => void;
  onDuplicateProject?: (id: string) => void;
  onPinProject?: (id: string, pinned: boolean) => void;
  onRenameProject?: (id: string, name: string) => void;
  onRemoveFromFolder?: (id: string) => void;
  folderName?: string;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [view, setView] = useState<ViewMode>("grid");
  const [showArchived, setShowArchived] = useState(false);

  const filteredProjects = useMemo(() => {
    let result = projects.filter((p) => {
      const archived = Boolean(p.config?.archived);
      return archived === showArchived && p.name.toLowerCase().includes(query.toLowerCase());
    });
    result.sort((a, b) => {
      const pinDelta = Number(Boolean(b.config?.pinned)) - Number(Boolean(a.config?.pinned));
      if (pinDelta !== 0) return pinDelta;
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "created")
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
    return result;
  }, [projects, query, sort, showArchived]);

  function renameProject(project: Project) {
    const name = window.prompt("Rename project", project.name)?.trim();
    if (name && name !== project.name) onRenameProject?.(project.id, name);
  }

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
          <button
            onClick={() => setShowArchived((value) => !value)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm outline-none transition-colors ${
              showArchived
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            {showArchived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
            {showArchived ? "Archived" : "Active"}
          </button>
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
            <div
              key={project.id}
              className="group relative flex flex-col rounded-xl border border-neutral-200 bg-white hover:border-neutral-900"
            >
              <Link href={`/project/${project.id}`} className="block">
                <div className="relative aspect-video w-full overflow-hidden bg-neutral-50 p-2">
                  <ProjectThumbnail
                    workflow={project.workflow}
                    className="h-full w-full"
                  />
                </div>
                <div className="p-3 pr-24">
                  <p className="text-sm font-medium text-neutral-900 line-clamp-1">
                    {project.config?.pinned && <Pin className="mr-1 inline size-3 fill-neutral-900" />}
                    {project.name}
                  </p>
                  <p className="text-xs text-neutral-500">Canvas workflow</p>
                </div>
              </Link>
              <div className="absolute bottom-3 right-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                {onRenameProject && (
                  <button
                    onClick={() => renameProject(project)}
                    className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
                    title="Rename project"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                )}
                {onRemoveFromFolder && (
                  <button
                    onClick={() => onRemoveFromFolder(project.id)}
                    className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
                    title={`Remove from ${folderName ?? "current folder"}`}
                  >
                    <FolderX className="size-3.5" />
                  </button>
                )}
                {onPinProject && !project.config?.archived && (
                  <button
                    onClick={() => onPinProject(project.id, !project.config?.pinned)}
                    className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
                    title={project.config?.pinned ? "Unpin project" : "Pin project"}
                  >
                    <Pin className={`size-3.5 ${project.config?.pinned ? "fill-neutral-900 text-neutral-900" : ""}`} />
                  </button>
                )}
                {onDuplicateProject && !project.config?.archived && (
                  <button
                    onClick={() => onDuplicateProject(project.id)}
                    className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
                    title="Duplicate project"
                  >
                    <Copy className="size-3.5" />
                  </button>
                )}
                {onArchiveProject && (
                  <button
                    onClick={() => onArchiveProject(project.id, !project.config?.archived)}
                    className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
                    title={project.config?.archived ? "Restore project" : "Archive project"}
                  >
                    {project.config?.archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
                  </button>
                )}
                {onDeleteProject && (
                  <button
                    onClick={() => onDeleteProject(project.id)}
                    className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                    title="Delete project"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="group flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-3 hover:border-neutral-900"
            >
              <Link href={`/project/${project.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-neutral-50">
                  <ProjectThumbnail
                    workflow={project.workflow}
                    className="h-full w-full"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900">
                    {project.config?.pinned && <Pin className="mr-1 inline size-3 fill-neutral-900" />}
                    {project.name}
                  </p>
                  <p className="text-xs text-neutral-500">Canvas workflow</p>
                </div>
              </Link>
              <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                {onRenameProject && (
                  <button onClick={() => renameProject(project)} className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900" title="Rename project">
                    <Pencil className="size-3.5" />
                  </button>
                )}
                {onRemoveFromFolder && (
                  <button onClick={() => onRemoveFromFolder(project.id)} className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900" title={`Remove from ${folderName ?? "current folder"}`}>
                    <FolderX className="size-3.5" />
                  </button>
                )}
                {onPinProject && !project.config?.archived && (
                  <button onClick={() => onPinProject(project.id, !project.config?.pinned)} className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900" title={project.config?.pinned ? "Unpin project" : "Pin project"}>
                    <Pin className={`size-3.5 ${project.config?.pinned ? "fill-neutral-900 text-neutral-900" : ""}`} />
                  </button>
                )}
                {onDuplicateProject && !project.config?.archived && (
                  <button onClick={() => onDuplicateProject(project.id)} className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900" title="Duplicate project">
                    <Copy className="size-3.5" />
                  </button>
                )}
                {onArchiveProject && (
                  <button onClick={() => onArchiveProject(project.id, !project.config?.archived)} className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900" title={project.config?.archived ? "Restore project" : "Archive project"}>
                    {project.config?.archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
                  </button>
                )}
                {onDeleteProject && (
                  <button onClick={() => onDeleteProject(project.id)} className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600" title="Delete project">
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
