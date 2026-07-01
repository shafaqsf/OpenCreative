import { notFound } from "next/navigation";
import { getProject } from "@/lib/ads/service";
import { ProjectEditor } from "@/components/project-editor/project-editor";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  return <ProjectEditor project={project} />;
}