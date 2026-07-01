import { Sidebar } from "@/components/dashboard/sidebar";

export default function Home() {
  return (
    <div className="flex h-dvh w-dvw bg-zinc-950 text-zinc-50">
      <Sidebar />
      <main className="flex flex-1 items-center justify-center">
        <span className="text-sm text-zinc-700">Canvas area</span>
      </main>
    </div>
  );
}
