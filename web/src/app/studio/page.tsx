import DiagramCanvas from "./components/canvas/diagram-canvas";

export default function CanvasPage() {
  return (
    <div className="w-screen h-screen overflow-hidden">
      <DiagramCanvas />
    </div>
  );
}
