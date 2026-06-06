"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Clock, Database } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import ProviderBadge from "./provider-badge";
import type { DatabaseProvider } from "@/lib/types";

const MOCK_RECENT_PROJECTS = [
  {
    id: "1",
    name: "Production DB",
    uri: "postgres://prod:5432/app",
    provider: "postgres" as DatabaseProvider,
    lastOpenedAt: "2024-01-15T10:30:00Z",
  },
  {
    id: "2",
    name: "Staging DB",
    uri: "mysql://staging:5432/app",
    provider: "mysql" as DatabaseProvider,
    lastOpenedAt: "2024-01-14T08:00:00Z",
  },
  {
    id: "3",
    name: "Local Dev",
    uri: "sqlite:///home/user/dev.db",
    provider: "sqlite" as DatabaseProvider,
    lastOpenedAt: "2024-01-13T16:45:00Z",
  },
];

export default function RecentProjects() {
  const router = useRouter();

  function handleRecentProject(projectId: string) {
    // Phase 2 — wire to useConnect + useUpdateLastOpened
    void projectId;
    router.push("/canvas");
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between px-0.5">
        <span className="text-sm font-medium text-text-tertiary">
          Recent projects
        </span>
        <button
          onClick={() => router.push("/projects")}
          className="flex items-center gap-1 text-sm text-coral bg-transparent border-none cursor-pointer hover:opacity-80 transition-opacity">
          View all
          <ArrowRight size={12} aria-hidden />
        </button>
      </div>

      <div className="rounded-xl overflow-hidden border-[0.5px] border-border">
        {MOCK_RECENT_PROJECTS.map((project, index) => (
          <button
            key={project.id}
            onClick={() => handleRecentProject(project.id)}
            className={[
              "w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer transition-colors bg-node-bg hover:bg-surface-2",
              index !== 0 ? "border-t-[0.5px] border-node-row-border" : "",
            ].join(" ")}>
            <div className="flex items-center justify-center w-8 h-8 rounded-md shrink-0 bg-surface-3">
              <Database size={13} className="text-text-tertiary" aria-hidden />
            </div>

            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className="text-sm font-medium truncate text-text-primary">
                {project.name}
              </span>
              <span className="text-xs truncate text-text-tertiary font-mono">
                {project.uri}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <ProviderBadge provider={project.provider} />
              <span className="flex items-center gap-1 text-xs text-text-tertiary">
                <Clock size={11} aria-hidden />
                {formatRelativeTime(project.lastOpenedAt)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
