import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ArrowLeft } from "lucide-react";
import { listFolders, listProjects, createProject } from "@/lib/projects/service";
import { CreateProjectDialog } from "@/components/dashboard/create-project-dialog";
import { FolderContent } from "@/components/dashboard/folder-content";

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

  async function handleCreate(name: string) {
    "use server";
    await createProject({ folder_id: id, name });
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
      <FolderContent folderId={id} projects={projects} onCreateProject={handleCreate} />
    </div>
  );
}
