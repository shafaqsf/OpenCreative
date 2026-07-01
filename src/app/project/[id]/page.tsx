import { notFound } from "next/navigation";
import { getProject } from "@/lib/projects/service";
import { ProjectCanvasEditor } from "./project-canvas";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  return <ProjectCanvasEditor project={project} />;
}