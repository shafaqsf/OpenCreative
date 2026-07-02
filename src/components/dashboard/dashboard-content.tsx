"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Folder,
  FolderOpen,
  MoreHorizontal,
  Plus,
  Search,
  Grid3X3,
  List,
  Trash2,
  FolderInput,
  FolderX,
  Pencil,
  Archive,
  ArchiveRestore,
  Copy,
  Pin,
  Check,
  X,
} from "lucide-react";
import type { Folder as FolderType, Project } from "@/lib/projects/service";
import { CreateProjectDialog } from "./create-project-dialog";
import { DashboardCommands } from "./dashboard-commands";
import { ProjectThumbnail } from "./project-thumbnail";

type SortKey = "name" | "recent" | "created";
type ViewMode = "grid" | "list";

export function DashboardContent({
  folders,
  allProjects,
  onCreateProject,
  onDeleteFolder,
  onRenameFolder,
  onDeleteProject,
  onArchiveProject,
  onDuplicateProject,
  onPinProject,
  onRenameProject,
  onMoveProject,
}: {
  folders: FolderType[];
  allProjects: Project[];
  onCreateProject: (name: string) => void;
  onDeleteFolder?: (id: string) => void;
  onRenameFolder?: (id: string, name: string) => void;
  onDeleteProject?: (id: string) => void;
  onArchiveProject?: (id: string, archived: boolean) => void;
  onDuplicateProject?: (id: string) => void;
  onPinProject?: (id: string, pinned: boolean) => void;
  onRenameProject?: (id: string, name: string) => void;
  onMoveProject?: (id: string, folderId: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [view, setView] = useState<ViewMode>("grid");
  const [showArchived, setShowArchived] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [folderDraft, setFolderDraft] = useState("");

  const filteredProjects = useMemo(() => {
    let result = allProjects.filter((p) => {
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
  }, [allProjects, query, sort, showArchived]);

  function startRenameFolder(folder: FolderType) {
    setEditingFolderId(folder.id);
    setFolderDraft(folder.name);
  }

  function commitRenameFolder(folder: FolderType) {
    const name = folderDraft.trim();
    if (name && name !== folder.name) onRenameFolder?.(folder.id, name);
    setEditingFolderId(null);
    setFolderDraft("");
  }

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

      {filteredFolders.length > 0 && (
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-neutral-500">
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
                  {editingFolderId === folder.id ? (
                    <div className="flex items-center gap-3 rounded-xl border border-neutral-300 bg-white p-4">
                      <FolderOpen className="size-5 text-neutral-400" />
                      <input
                        autoFocus
                        value={folderDraft}
                        onChange={(e) => setFolderDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRenameFolder(folder);
                          if (e.key === "Escape") setEditingFolderId(null);
                        }}
                        className="min-w-0 flex-1 rounded-md border border-neutral-200 px-2 py-1 text-sm outline-none focus:border-neutral-400"
                      />
                      <button onClick={() => commitRenameFolder(folder)} className="rounded p-1 text-neutral-500 hover:text-neutral-900" title="Save folder name">
                        <Check className="size-3.5" />
                      </button>
                      <button onClick={() => setEditingFolderId(null)} className="rounded p-1 text-neutral-500 hover:text-neutral-900" title="Cancel rename">
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : (
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
                  )}
                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {onRenameFolder && editingFolderId !== folder.id && (
                      <button
                        onClick={() => startRenameFolder(folder)}
                        className="rounded p-1 text-neutral-400 hover:bg-white hover:text-neutral-900"
                        title="Rename folder"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    )}
                    {onDeleteFolder && (
                      <button
                        onClick={() => onDeleteFolder(folder.id)}
                        className="rounded p-1 text-neutral-400 hover:bg-white hover:text-red-600"
                        title="Delete folder"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-neutral-500">
            {query ? "Search results" : showArchived ? "Archived projects" : "Recent projects"}
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
                folders={folders}
                onDeleteProject={onDeleteProject}
                onArchiveProject={onArchiveProject}
                onDuplicateProject={onDuplicateProject}
                onPinProject={onPinProject}
                onRenameProject={onRenameProject}
                onMoveProject={onMoveProject}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredProjects.slice(0, 24).map((project) => (
              <ProjectListItem
                key={project.id}
                project={project}
                folders={folders}
                onDeleteProject={onDeleteProject}
                onArchiveProject={onArchiveProject}
                onDuplicateProject={onDuplicateProject}
                onPinProject={onPinProject}
                onRenameProject={onRenameProject}
                onMoveProject={onMoveProject}
              />
            ))}
          </div>
        )}
      </section>
    </main>
    </>
  );
}

function ProjectMenu({
  project,
  folders,
  onRenameProject,
  onDeleteProject,
  onArchiveProject,
  onDuplicateProject,
  onPinProject,
  onMoveProject,
}: {
  project: Project;
  folders: FolderType[];
  onRenameProject?: (id: string, name: string) => void;
  onDeleteProject?: (id: string) => void;
  onArchiveProject?: (id: string, archived: boolean) => void;
  onDuplicateProject?: (id: string) => void;
  onPinProject?: (id: string, pinned: boolean) => void;
  onMoveProject?: (id: string, folderId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(project.name);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [open]);

  const availableFolders = folders.filter((f) => f.id !== project.folder_id);
  const currentFolder = folders.find((f) => f.id === project.folder_id);
  const isArchived = Boolean(project.config?.archived);
  const isPinned = Boolean(project.config?.pinned);

  function commitRenameProject() {
    const name = draft.trim();
    if (name && name !== project.name) onRenameProject?.(project.id, name);
    setRenaming(false);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className="p-1 text-neutral-400 hover:text-neutral-700"
        title="More actions"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
          {onRenameProject && (
            renaming ? (
              <div className="flex items-center gap-1 px-2 py-1.5">
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRenameProject();
                    if (e.key === "Escape") setRenaming(false);
                  }}
                  className="min-w-0 flex-1 rounded-md border border-neutral-200 px-2 py-1 text-xs outline-none focus:border-neutral-400"
                />
                <button onClick={commitRenameProject} className="rounded p-1 text-neutral-500 hover:text-neutral-900" title="Save name">
                  <Check className="size-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDraft(project.name);
                  setRenaming(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-neutral-700 hover:bg-neutral-100"
              >
                <Pencil className="size-3.5 text-neutral-400" />
                Rename project
              </button>
            )
          )}
          {onPinProject && !isArchived && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPinProject(project.id, !isPinned);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-neutral-700 hover:bg-neutral-100"
            >
              <Pin className={`size-3.5 ${isPinned ? "fill-neutral-900 text-neutral-900" : "text-neutral-400"}`} />
              {isPinned ? "Unpin project" : "Pin project"}
            </button>
          )}
          {onDuplicateProject && !isArchived && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDuplicateProject(project.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-neutral-700 hover:bg-neutral-100"
            >
              <Copy className="size-3.5 text-neutral-400" />
              Duplicate project
            </button>
          )}
          {availableFolders.length > 0 && (
            <div className="px-3 py-1.5 text-xs font-semibold text-neutral-500">
              Move to folder
            </div>
          )}
          {availableFolders.map((f) => (
            <button
              key={f.id}
              onClick={(e) => {
                e.stopPropagation();
                onMoveProject?.(project.id, f.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-100"
            >
              <FolderInput className="size-3.5 text-neutral-400" />
              {f.name}
            </button>
          ))}
          {project.folder_id && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveProject?.(project.id, null);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-100"
            >
              <FolderX className="size-3.5 text-neutral-400" />
              Remove from {currentFolder?.name ?? "current folder"}
            </button>
          )}
          {availableFolders.length === 0 && !project.folder_id && (
            <div className="px-3 py-2 text-xs text-neutral-400">
              No other folders
            </div>
          )}
          {onDeleteProject && (
            <>
              <div className="my-1 border-t border-neutral-100" />
              {onArchiveProject && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onArchiveProject(project.id, !isArchived);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-neutral-700 hover:bg-neutral-100"
                >
                  {isArchived ? <ArchiveRestore className="size-3.5 text-neutral-400" /> : <Archive className="size-3.5 text-neutral-400" />}
                  {isArchived ? "Restore project" : "Archive project"}
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteProject(project.id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50"
              >
                <Trash2 className="size-3.5" />
                Delete project
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  folders,
  onDeleteProject,
  onArchiveProject,
  onDuplicateProject,
  onPinProject,
  onRenameProject,
  onMoveProject,
}: {
  project: Project;
  folders: FolderType[];
  onDeleteProject?: (id: string) => void;
  onArchiveProject?: (id: string, archived: boolean) => void;
  onDuplicateProject?: (id: string) => void;
  onPinProject?: (id: string, pinned: boolean) => void;
  onRenameProject?: (id: string, name: string) => void;
  onMoveProject?: (id: string, folderId: string | null) => void;
}) {
  const router = useRouter();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/project/${project.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/project/${project.id}`);
      }}
      className="group relative flex cursor-pointer flex-col rounded-lg border border-neutral-200 bg-white hover:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
    >
      <div className="p-2">
        <div className="aspect-video w-full overflow-hidden rounded-md bg-neutral-100">
          <ProjectThumbnail
            workflow={project.workflow}
            className="h-full w-full"
          />
        </div>
      </div>
      <div className="p-3">
        <div className="mb-1 flex items-start justify-between">
          <p className="text-sm font-medium text-neutral-900 line-clamp-1">
            {project.config?.pinned && <Pin className="mr-1 inline size-3 fill-neutral-900" />}
            {project.name}
          </p>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
            <ProjectMenu
              project={project}
              folders={folders}
              onRenameProject={onRenameProject}
              onDeleteProject={onDeleteProject}
              onArchiveProject={onArchiveProject}
              onDuplicateProject={onDuplicateProject}
              onPinProject={onPinProject}
              onMoveProject={onMoveProject}
            />
          </div>
        </div>
        <p className="text-xs text-neutral-500">Canvas workflow</p>
      </div>
    </div>
  );
}

function ProjectListItem({
  project,
  folders,
  onDeleteProject,
  onArchiveProject,
  onDuplicateProject,
  onPinProject,
  onRenameProject,
  onMoveProject,
}: {
  project: Project;
  folders: FolderType[];
  onDeleteProject?: (id: string) => void;
  onArchiveProject?: (id: string, archived: boolean) => void;
  onDuplicateProject?: (id: string) => void;
  onPinProject?: (id: string, pinned: boolean) => void;
  onRenameProject?: (id: string, name: string) => void;
  onMoveProject?: (id: string, folderId: string | null) => void;
}) {
  const router = useRouter();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/project/${project.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/project/${project.id}`);
      }}
      className="group flex cursor-pointer items-center gap-4 rounded-lg border border-neutral-200 bg-white p-3 hover:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
    >
      <div className="size-16 shrink-0 overflow-hidden rounded-md bg-neutral-100">
        <ProjectThumbnail workflow={project.workflow} className="h-full w-full" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-900 truncate">
          {project.config?.pinned && <Pin className="mr-1 inline size-3 fill-neutral-900" />}
          {project.name}
        </p>
        <p className="text-xs text-neutral-500">Canvas workflow</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ProjectMenu
          project={project}
          folders={folders}
          onRenameProject={onRenameProject}
          onDeleteProject={onDeleteProject}
          onArchiveProject={onArchiveProject}
          onDuplicateProject={onDuplicateProject}
          onPinProject={onPinProject}
          onMoveProject={onMoveProject}
        />
      </div>
    </div>
  );
}
