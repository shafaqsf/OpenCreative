import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Folder, FolderOpen, MoreHorizontal, Plus } from "lucide-react";
import { listFolders, listProjects, createFolder, createProject } from "@/lib/projects/service";
import { CreateFolderDialog } from "@/components/dashboard/create-folder-dialog";
import { CreateProjectDialog } from "@/components/dashboard/create-project-dialog";

export default async function DashboardPage() {
  const folders = await listFolders();
  const allProjects = await listProjects();

  async function handleCreateFolder(name: string) {
    "use server";
    await createFolder(name);
    revalidatePath("/");
  }

  async function handleCreateProject(name: string) {
    "use server";
    await createProject({ name });
    revalidatePath("/");
  }

  return (
    <div className="flex h-dvh w-dvw flex-col overflow-hidden bg-white text-neutral-900">
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-neutral-900 text-white">
            <span className="text-xs font-bold">OC</span>
          </div>
          <span className="text-sm font-semibold tracking-tight">
            OpenCreative
          </span>
        </div>
        <CreateFolderDialog onCreate={handleCreateFolder} />
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Folders
            </h2>
            <CreateProjectDialog onCreate={handleCreateProject} />
          </div>
          {folders.length === 0 ? (
            <p className="text-sm text-neutral-400">No folders yet</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {folders.map((folder) => {
                const count = allProjects.filter(
                  (p) => p.folder_id === folder.id
                ).length;
                return (
                  <Link
                    key={folder.id}
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
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Recent projects
          </h2>
          {allProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 py-16">
              <Folder className="size-8 text-neutral-300" />
              <p className="mt-3 text-sm text-neutral-500">
                No projects yet. Create one to start building on the canvas.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {allProjects.slice(0, 12).map((project) => (
                <Link
                  key={project.id}
                  href={`/project/${project.id}`}
                  className="group relative rounded-xl border border-neutral-200 bg-white p-4 hover:border-neutral-900"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-neutral-100">
                      <Plus className="size-5 text-neutral-400" />
                    </div>
                    <MoreHorizontal className="size-4 text-neutral-300 opacity-0 group-hover:opacity-100" />
                  </div>
                  <p className="text-sm font-medium text-neutral-900">
                    {project.name}
                  </p>
                  <p className="text-xs text-neutral-500">Canvas workflow</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}