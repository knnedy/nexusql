import { Suspense } from "react";
import { ProjectsView } from "@/features/projects";

export default function ProjectsPage() {
  // The view reads its filter from the URL, which needs a Suspense boundary in a static export.
  return (
    <Suspense fallback={null}>
      <ProjectsView />
    </Suspense>
  );
}
