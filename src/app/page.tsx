import { Sidebar } from "@/components/dashboard/sidebar";

export default function Home() {
  return (
    <div className="flex h-dvh w-dvw overflow-hidden bg-white text-neutral-900">
      <Sidebar />
      <main className="canvas-grid flex-1" />
    </div>
  );
}