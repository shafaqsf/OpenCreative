import { revalidatePath } from "next/cache";
import { listCampaignSummaries, listFolders, createFolder, createProject, deleteFolder, deleteProject, duplicateProject, updateFolderName, updateProjectConfig, updateProjectFolder, updateProjectName } from "@/lib/projects/service";
import { CreateFolderDialog } from "@/components/dashboard/create-folder-dialog";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export default async function DashboardPage() {
  const [folders, allProjects] = await Promise.all([
    listFolders(),
    listCampaignSummaries(),
  ]);

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

  async function handleRenameFolder(id: string, name: string) {
    "use server";
    await updateFolderName(id, name);
    revalidatePath("/");
  }

  async function handleDeleteProject(id: string) {
    "use server";
    await deleteProject(id);
    revalidatePath("/");
  }

  async function handleArchiveProject(id: string, archived: boolean) {
    "use server";
    await updateProjectConfig(id, {
      archived,
      archived_at: archived ? new Date().toISOString() : null,
    });
    revalidatePath("/");
  }

  async function handleDuplicateProject(id: string) {
    "use server";
    await duplicateProject(id);
    revalidatePath("/");
  }

  async function handlePinProject(id: string, pinned: boolean) {
    "use server";
    await updateProjectConfig(id, { pinned });
    revalidatePath("/");
  }

  async function handleRenameProject(id: string, name: string) {
    "use server";
    await updateProjectName(id, name);
    revalidatePath("/");
  }

  async function handleMoveProject(id: string, folderId: string | null) {
    "use server";
    await updateProjectFolder(id, folderId);
    revalidatePath("/");
  }

  return (
    <>
      <div className="flex h-dvh w-dvw flex-col overflow-hidden bg-[var(--oc-surface)] text-neutral-900">
        <header className="glass-panel-strong z-10 flex items-center justify-between border-x-0 border-t-0 px-6 py-3.5">
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
          onRenameFolder={handleRenameFolder}
          onDeleteProject={handleDeleteProject}
          onArchiveProject={handleArchiveProject}
          onDuplicateProject={handleDuplicateProject}
          onPinProject={handlePinProject}
          onRenameProject={handleRenameProject}
          onMoveProject={handleMoveProject}
        />
      </div>
    </>
  );
}
