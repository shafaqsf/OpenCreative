import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ArrowLeft, Plus } from "lucide-react";
import { listFolders, listProjects, createProject } from "@/lib/ads/service";
import { CreateProjectDialog } from "@/components/dashboard/create-project-dialog";
import type { AdType } from "@/types/ads";

export default async function FolderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const folders = await listFolders();
  const folder = folders.find((f) => f.id === id);
  if (!folder) return <div>Folder not found</div>;
  const projects = await listProjects(id);

  async function handleCreate(name: string, adType: AdType) {
    "use server";
    await createProject(id, name, adType);
    revalidatePath(`/folder/${id}`);
  }

  return (
    <div className="flex h-dvh w-dvw flex-col overflow-hidden bg-white text-neutral-900">
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3.5">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex size-8 items-center justify-center rounded-md hover:bg-neutral-100"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="text-sm font-semibold">{folder.name}</h1>
        </div>
        <CreateProjectDialog folderId={id} onCreate={handleCreate} />
      </header>
      <main className="flex-1 overflow-y-auto p-6">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 py-16">
            <Plus className="size-8 text-neutral-300" />
            <p className="mt-3 text-sm text-neutral-500">
              No projects in this folder yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/project/${project.id}`}
                className="rounded-xl border border-neutral-200 bg-white p-4 hover:border-neutral-900"
              >
                <p className="text-sm font-medium text-neutral-900">
                  {project.name}
                </p>
                <p className="text-xs text-neutral-500">{project.ad_type}</p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}