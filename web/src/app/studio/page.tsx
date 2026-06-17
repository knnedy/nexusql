"use client";

import { useStudioStore } from "@/lib/store/studio-store";
import DiagramCanvas from "./components/canvas/diagram-canvas";
import Explorer from "./components/explorer/explorer";

export default function StudioPage() {
  const viewMode = useStudioStore((s) => s.viewMode);

  return (
    <div className="w-screen h-screen overflow-hidden">
      {viewMode === "canvas" ? <DiagramCanvas /> : <Explorer />}
    </div>
  );
}
