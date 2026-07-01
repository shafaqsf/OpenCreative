"use client";

import { CanvasProvider } from "@/lib/canvas/context";
import { useKeyboardShortcuts } from "@/lib/canvas/use-keyboard-shortcuts";
import { Canvas } from "@/components/canvas/canvas";
import { ZoomControls } from "@/components/canvas/zoom-controls";
import { Sidebar } from "@/components/dashboard/sidebar";

function Workspace() {
  useKeyboardShortcuts();
  return (
    <div className="flex h-dvh w-dvw overflow-hidden bg-white text-neutral-900">
      <Sidebar />
      <main className="relative flex-1">
        <Canvas />
        <ZoomControls />
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <CanvasProvider>
      <Workspace />
    </CanvasProvider>
  );
}