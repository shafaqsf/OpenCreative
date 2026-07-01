import Link from "next/link";
import { revalidatePath } from "next/cache";
import { FolderPlus } from "lucide-react";
import { listFolders, listProjects, createFolder, createProject, deleteFolder, deleteProject, updateProjectFolder } from "@/lib/projects/service";
import { CreateFolderDialog } from "@/components/dashboard/create-folder-dialog";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

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

  async function handleDeleteFolder(id: string) {
    "use server";
    await deleteFolder(id);
    revalidatePath("/");
  }

  async function handleDeleteProject(id: string) {
    "use server";
    await deleteProject(id);
    revalidatePath("/");
  }

  async function handleMoveProject(id: string, folderId: string | null) {
    "use server";
    await updateProjectFolder(id, folderId);
    revalidatePath("/");
  }

  return (
    <>
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

        <DashboardContent
          folders={folders}
          allProjects={allProjects}
          onCreateProject={handleCreateProject}
          onDeleteFolder={handleDeleteFolder}
          onDeleteProject={handleDeleteProject}
        />
      </div>
    </>
  );
}
