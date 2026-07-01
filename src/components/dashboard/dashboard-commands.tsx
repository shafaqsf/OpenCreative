"use client";

import { useRouter } from "next/navigation";
import { LayoutGrid, FolderPlus, PlusSquare, Home } from "lucide-react";
import { useRegisterCommands } from "@/lib/command-palette/context";

export function DashboardCommands({
  folders,
  projects,
}: {
  folders: { id: string; name: string }[];
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();

  useRegisterCommands([
    {
      id: "nav-dashboard",
      title: "Go to Dashboard",
      section: "Navigation",
      icon: <Home className="size-3.5" />,
      onSelect: () => router.push("/"),
    },
    {
      id: "action-new-folder",
      title: "New folder",
      section: "Actions",
      icon: <FolderPlus className="size-3.5" />,
      onSelect: () => {
        // Trigger is hard to access from here; users can use the dashboard button
      },
    },
    ...folders.map((f) => ({
      id: `folder-${f.id}`,
      title: `Open folder: ${f.name}`,
      section: "Folders",
      icon: <LayoutGrid className="size-3.5" />,
      onSelect: () => router.push(`/folder/${f.id}`),
    })),
    ...projects.map((p) => ({
      id: `project-${p.id}`,
      title: `Open project: ${p.name}`,
      section: "Projects",
      icon: <PlusSquare className="size-3.5" />,
      onSelect: () => router.push(`/project/${p.id}`),
    })),
  ]);

  return null;
}
