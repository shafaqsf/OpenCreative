"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Folder,
  FolderOpen,
  MoreHorizontal,
  Plus,
  Search,
  Grid3X3,
  List,
  ArrowDownAZ,
  Clock,
  Calendar,
  Trash2,
} from "lucide-react";
import type { Folder as FolderType, Project } from "@/lib/projects/service";
import { CreateProjectDialog } from "./create-project-dialog";
import { DashboardCommands } from "./dashboard-commands";
import { PinButton, usePinnedProjects } from "./project-pins";
import { ProjectThumbnail } from "./project-thumbnail";

type SortKey = "name" | "recent" | "created";
type ViewMode = "grid" | "list";

export function DashboardContent({
  folders,
  allProjects,
  onCreateProject,
  onDeleteFolder,
  onDeleteProject,
}: {
  folders: FolderType[];
  allProjects: Project[];
  onCreateProject: (name: string) => void;
  onDeleteFolder?: (id: string) => void;
  onDeleteProject?: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [view, setView] = useState<ViewMode>("grid");
  const { pinned, toggle } = usePinnedProjects();

  const filteredProjects = useMemo(() => {
    let result = allProjects.filter((p) =>
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
    // pinned first
    result.sort((a, b) => {
      const ap = pinned.has(a.id) ? 1 : 0;
      const bp = pinned.has(b.id) ? 1 : 0;
      return bp - ap;
    });
    return result;
  }, [allProjects, query, sort, pinned]);

  const filteredFolders = useMemo(
    () =>
      folders.filter((f) => f.name.toLowerCase().includes(query.toLowerCase())),
    [folders, query]
  );

  return (
    <>
      <DashboardCommands folders={folders} projects={allProjects} />
      <main className="flex-1 overflow-y-auto p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects and folders…"
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

      {filteredFolders.length > 0 && (
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Folders
            </h2>
          </div>
          <div
            className={`grid gap-3 ${
              view === "grid"
                ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
                : "grid-cols-1"
            }`}
          >
              {filteredFolders.map((folder) => {
              const count = allProjects.filter(
                (p) => p.folder_id === folder.id
              ).length;
              return (
                <div
                  key={folder.id}
                  className="group relative"
                >
                  <Link
                    href={`/folder/${folder.id}`}
                    className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 hover:border-neutral-900"
                  >
                    <FolderOpen className="size-5 text-neutral-400" />
                    <div>
                      <p className="text-sm font-medium text-neutral-900">
                        {folder.name}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {count} project{count !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </Link>
                  {onDeleteFolder && (
                    <button
                      onClick={() => onDeleteFolder(folder.id)}
                      className="absolute right-2 top-2 p-1 text-neutral-400 opacity-0 hover:text-red-600 group-hover:opacity-100 transition-opacity"
                      title="Delete folder"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            {query ? "Search results" : "Recent projects"}
          </h2>
          <CreateProjectDialog onCreate={onCreateProject} />
        </div>
        {filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 py-16">
            <Folder className="size-8 text-neutral-300" />
            <p className="mt-3 text-sm text-neutral-500">
              {query
                ? "No projects match your search."
                : "No projects yet. Create one to start building on the canvas."}
            </p>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filteredProjects.slice(0, 24).map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                pinned={pinned.has(project.id)}
                onTogglePin={toggle}
                onDeleteProject={onDeleteProject}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredProjects.slice(0, 24).map((project) => (
              <ProjectListItem
                key={project.id}
                project={project}
                pinned={pinned.has(project.id)}
                onTogglePin={toggle}
                onDeleteProject={onDeleteProject}
              />
            ))}
          </div>
        )}
      </section>
    </main>
    </>
  );
}

function ProjectCard({
  project,
  pinned,
  onTogglePin,
  onDeleteProject,
}: {
  project: Project;
  pinned: boolean;
  onTogglePin: (id: string) => void;
  onDeleteProject?: (id: string) => void;
}) {
  return (
    <Link
      href={`/project/${project.id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white hover:border-neutral-900"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-neutral-50 p-2">
        <ProjectThumbnail
          workflow={project.workflow}
          className="h-full w-full"
        />
        <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
          <PinButton projectId={project.id} pinned={pinned} onToggle={onTogglePin} />
        </div>
      </div>
      <div className="p-3">
        <div className="mb-1 flex items-start justify-between">
          <p className="text-sm font-medium text-neutral-900 line-clamp-1">
            {project.name}
          </p>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
            {onDeleteProject && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onDeleteProject(project.id);
                }}
                className="p-1 text-neutral-400 hover:text-red-600"
                title="Delete project"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
            <MoreHorizontal className="size-4 text-neutral-300" />
          </div>
        </div>
        <p className="text-xs text-neutral-500">Canvas workflow</p>
      </div>
    </Link>
  );
}

function ProjectListItem({
  project,
  pinned,
  onTogglePin,
  onDeleteProject,
}: {
  project: Project;
  pinned: boolean;
  onTogglePin: (id: string) => void;
  onDeleteProject?: (id: string) => void;
}) {
  return (
    <Link
      href={`/project/${project.id}`}
      className="group flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-3 hover:border-neutral-900"
    >
      <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-neutral-50">
        <ProjectThumbnail workflow={project.workflow} className="h-full w-full" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-neutral-900">{project.name}</p>
        <p className="text-xs text-neutral-500">Canvas workflow</p>
      </div>
      <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        <PinButton projectId={project.id} pinned={pinned} onToggle={onTogglePin} />
        {onDeleteProject && (
          <button
            onClick={(e) => {
              e.preventDefault();
              onDeleteProject(project.id);
            }}
            className="p-1 text-neutral-400 hover:text-red-600"
            title="Delete project"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
        <MoreHorizontal className="size-4 text-neutral-300" />
      </div>
    </Link>
  );
}
