import type { Metadata } from "next";
import DiagramCanvas from "./components/diagram-canvas";

export const metadata: Metadata = {
  title: "Canvas | NexusQL",
};

export default function CanvasPage() {
  return (
    <div className="w-screen h-screen overflow-hidden bg-canvas-bg">
      <DiagramCanvas />
    </div>
  );
}
