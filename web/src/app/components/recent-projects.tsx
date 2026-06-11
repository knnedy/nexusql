"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Clock, Database, Loader2 } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import ProviderBadge from "./provider-badge";
import { useProjects, useTouchProject } from "@/hooks/use-projects";
import { useConnect } from "@/hooks/use-connect";
import { DatabaseProvider } from "@/lib/types";

export default function RecentProjects() {
  const router = useRouter();
  const { data, isLoading } = useProjects();
  const touch = useTouchProject();
  const connect = useConnect();

  const projects = data?.projects ?? [];
  const recent = [...projects]
    .sort(
      (a, b) =>
        new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime(),
    )
    .slice(0, 3);

  function handleRecentProject(
    id: string,
    uri: string,
    provider: DatabaseProvider,
  ) {
    touch.mutate(id);
    connect.mutate({ uri, provider });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6 text-text-tertiary">
        <Loader2 size={14} className="animate-spin" />
      </div>
    );
  }

  if (recent.length === 0) return null;

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
        {recent.map((project, index) => (
          <button
            key={project.id}
            onClick={() =>
              handleRecentProject(project.id, project.uri, project.provider)
            }
            disabled={connect.isPending}
            className={[
              "w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer transition-colors bg-node-bg hover:bg-surface-2 disabled:opacity-60 disabled:cursor-not-allowed",
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
