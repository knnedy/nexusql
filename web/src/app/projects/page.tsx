"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Database,
  Trash2,
  Pencil,
  Check,
  X,
  Clock,
  ArrowLeft,
  Loader2,
  FolderOpen,
} from "lucide-react";
import TopNav from "@/app/components/top-nav";
import ProviderBadge from "@/app/components/provider-badge";
import {
  useProjects,
  useDeleteProject,
  useRenameProject,
} from "@/hooks/use-projects";
import { useConnect } from "@/hooks/use-connect";
import { formatRelativeTime } from "@/lib/utils";
import type { DatabaseProvider } from "@/lib/types";

function EmptyState() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="w-12 h-12 rounded-xl bg-surface-3 flex items-center justify-center">
        <FolderOpen size={20} className="text-text-tertiary" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-text-secondary">
          No projects yet
        </span>
        <span className="text-xs text-text-tertiary">
          Connect a database to create your first project
        </span>
      </div>
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium bg-coral text-white hover:bg-coral-hover transition-colors cursor-pointer border-none">
        Connect a database
      </button>
    </div>
  );
}

function ProjectRow({
  project,
}: {
  project: {
    id: string;
    name: string;
    uri: string;
    provider: DatabaseProvider;
    lastOpenedAt: string;
    createdAt: string;
  };
}) {
  const connect = useConnect();
  const deleteProject = useDeleteProject();
  const renameProject = useRenameProject();

  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(project.name);

  function handleOpen() {
    connect.mutate({
      uri: project.uri,
      provider: project.provider,
      name: project.name,
    });
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    deleteProject.mutate(project.id);
  }

  function handleRenameSubmit(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation();
    if (!nameInput.trim() || nameInput === project.name) {
      setEditing(false);
      setNameInput(project.name);
      return;
    }
    renameProject.mutate(
      { id: project.id, name: nameInput.trim() },
      { onSuccess: () => setEditing(false) },
    );
  }

  function handleRenameCancel(e: React.MouseEvent) {
    e.stopPropagation();
    setEditing(false);
    setNameInput(project.name);
  }

  return (
    <div className="flex items-center gap-4 px-5 py-4 bg-node-bg border-b-[0.5px] border-border last:border-b-0 hover:bg-surface-2 transition-colors group">
      <div className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0 bg-surface-3">
        <Database size={14} className="text-text-tertiary" />
      </div>

      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        {editing ? (
          <div
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSubmit(e);
                if (e.key === "Escape") {
                  setEditing(false);
                  setNameInput(project.name);
                }
              }}
              className="text-sm font-medium text-text-primary bg-surface-2 border-[0.5px] border-border-strong rounded-md px-2 py-1 outline-none focus:border-coral transition-colors w-48"
            />
            <button
              onClick={handleRenameSubmit}
              disabled={renameProject.isPending}
              className="flex items-center justify-center w-6 h-6 rounded-md text-teal hover:bg-surface-3 transition-colors cursor-pointer border-none bg-transparent">
              {renameProject.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Check size={12} />
              )}
            </button>
            <button
              onClick={handleRenameCancel}
              className="flex items-center justify-center w-6 h-6 rounded-md text-text-tertiary hover:bg-surface-3 transition-colors cursor-pointer border-none bg-transparent">
              <X size={12} />
            </button>
          </div>
        ) : (
          <span className="text-sm font-medium text-text-primary truncate">
            {project.name}
          </span>
        )}
        <span className="text-xs text-text-tertiary font-mono truncate">
          {project.uri}
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <ProviderBadge provider={project.provider} />
        <span className="flex items-center gap-1 text-xs text-text-tertiary">
          <Clock size={11} />
          {formatRelativeTime(project.lastOpenedAt)}
        </span>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          className="flex items-center justify-center w-7 h-7 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-3 transition-colors cursor-pointer border-none bg-transparent">
          <Pencil size={13} />
        </button>
        <button
          onClick={handleDelete}
          disabled={deleteProject.isPending}
          className="flex items-center justify-center w-7 h-7 rounded-md text-text-tertiary hover:text-red-500 hover:bg-surface-3 transition-colors cursor-pointer border-none bg-transparent">
          {deleteProject.isPending ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Trash2 size={13} />
          )}
        </button>
        <button
          onClick={handleOpen}
          disabled={connect.isPending}
          className="flex items-center gap-1.5 px-3 h-7 rounded-md text-xs font-medium text-white bg-coral hover:bg-coral-hover transition-colors cursor-pointer border-none disabled:opacity-60">
          {connect.isPending ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            "Open"
          )}
        </button>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const { data, isLoading } = useProjects();

  const projects = [...(data?.projects ?? [])].sort(
    (a, b) =>
      new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime(),
  );

  return (
    <>
      <TopNav />
      <main className="flex flex-col items-center min-h-screen pt-20 pb-12 px-4 bg-canvas-bg">
        <div className="w-full max-w-2xl flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="flex items-center justify-center w-8 h-8 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors cursor-pointer border-none bg-transparent">
              <ArrowLeft size={15} />
            </button>
            <div className="flex flex-col">
              <h1 className="text-lg font-semibold text-text-primary tracking-tight">
                All projects
              </h1>
              <span className="text-xs text-text-tertiary">
                {projects.length}{" "}
                {projects.length === 1 ? "project" : "projects"} saved locally
              </span>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-text-tertiary">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : projects.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="rounded-xl overflow-hidden border-[0.5px] border-border">
              {projects.map((project) => (
                <ProjectRow key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
