import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ArrowLeft } from "lucide-react";
import { deleteProject, duplicateProject, listCampaignSummaries, listFolders, createProject, updateProjectConfig, updateProjectFolder, updateProjectName } from "@/lib/projects/service";
import { CreateProjectDialog } from "@/components/dashboard/create-project-dialog";
import { FolderContent } from "@/components/dashboard/folder-content";

export default async function FolderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const validFolderId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  const [folders, projects] = await Promise.all([
    listFolders(),
    validFolderId ? listCampaignSummaries(id) : Promise.resolve([]),
  ]);
  const folder = folders.find((f) => f.id === id);
  if (!folder) return <div>Workspace not found</div>;

  async function handleCreate(name: string) {
    "use server";
    await createProject({ folder_id: id, name });
    revalidatePath(`/folder/${id}`);
  }

  async function handleDeleteProject(projectId: string) {
    "use server";
    await deleteProject(projectId);
    revalidatePath(`/folder/${id}`);
  }

  async function handleDuplicateProject(projectId: string) {
    "use server";
    await duplicateProject(projectId);
    revalidatePath(`/folder/${id}`);
  }

  async function handlePinProject(projectId: string, pinned: boolean) {
    "use server";
    await updateProjectConfig(projectId, { pinned });
    revalidatePath(`/folder/${id}`);
  }

  async function handleRenameProject(projectId: string, name: string) {
    "use server";
    await updateProjectName(projectId, name);
    revalidatePath(`/folder/${id}`);
  }

  async function handleRemoveFromFolder(projectId: string) {
    "use server";
    await updateProjectFolder(projectId, null);
    revalidatePath(`/folder/${id}`);
  }

  return (
    <div className="flex h-dvh w-dvw flex-col overflow-hidden bg-[var(--oc-surface)] text-neutral-900">
      <header className="glass-panel-strong z-10 flex items-center justify-between border-x-0 border-t-0 px-6 py-3.5">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex size-8 items-center justify-center rounded-md hover:bg-neutral-100"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <p className="text-xs text-neutral-500">Workspace</p>
            <h1 className="text-sm font-semibold">{folder.name}</h1>
          </div>
        </div>
        <CreateProjectDialog folderId={id} onCreate={handleCreate} />
      </header>
      <FolderContent
        folderId={id}
        projects={projects}
        onCreateProject={handleCreate}
        onDeleteProject={handleDeleteProject}
        onDuplicateProject={handleDuplicateProject}
        onPinProject={handlePinProject}
        onRenameProject={handleRenameProject}
        onRemoveFromFolder={handleRemoveFromFolder}
        folderName={folder.name}
      />
    </div>
  );
}
