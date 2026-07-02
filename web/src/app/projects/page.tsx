"use client";

import { useState, useMemo } from "react";
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
  Search,
  Eye,
  EyeOff,
  ServerCrash,
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
import type { DatabaseProvider, Project } from "@/lib/types";

const PROVIDER_FILTERS: { label: string; value: DatabaseProvider | "all" }[] = [
  { label: "All", value: "all" },
  { label: "PostgreSQL", value: "postgres" },
  { label: "MySQL", value: "mysql" },
  { label: "SQLite", value: "sqlite" },
];

function maskUri(uri: string): string {
  try {
    const url = new URL(uri);
    if (url.password) url.password = "••••••••";
    return url.toString();
  } catch {
    return uri;
  }
}

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-28 text-center rounded-2xl border border-dashed border-border/60 bg-surface-1/50">
      <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-border/50 flex items-center justify-center shadow-sm">
        {hasFilter ? (
          <ServerCrash size={24} className="text-text-tertiary" />
        ) : (
          <FolderOpen size={24} className="text-text-tertiary" />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[15px] font-semibold text-text-primary">
          {hasFilter ? "No matching projects found" : "No projects yet"}
        </span>
        <span className="text-[13px] text-text-tertiary max-w-62.5 leading-relaxed">
          {hasFilter
            ? "Try adjusting your search terms or provider filters to find what you're looking for."
            : "Connect your first database to start exploring and visualizing your schema."}
        </span>
      </div>
      {!hasFilter && (
        <button
          onClick={() => router.push("/")}
          className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-semibold bg-coral text-white hover:bg-coral-hover hover:shadow-md hover:shadow-coral/20 transition-all cursor-pointer border-none active:scale-95">
          <Database size={14} />
          Connect Database
        </button>
      )}
    </div>
  );
}

function ProjectRow({
  project,
  isConnected,
}: {
  project: Project;
  isConnected: boolean;
}) {
  const connect = useConnect();
  const deleteProject = useDeleteProject();
  const renameProject = useRenameProject();

  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(project.name);
  const [uriVisible, setUriVisible] = useState(false);

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
    <div
      onClick={handleOpen}
      className="group relative flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4 bg-surface-1 hover:bg-surface-2 border-b border-border/40 last:border-b-0 transition-all cursor-pointer overflow-hidden">
      {/* Icon */}
      <div className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 bg-linear-to-br from-surface-2 to-surface-3 border border-border shadow-sm">
        <Database size={16} className="text-coral" />
      </div>

      {/* Main Content */}
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
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
              className="text-[14px] font-semibold text-text-primary bg-surface-3 border border-coral/40 rounded-lg px-2.5 py-1 outline-none focus:border-coral focus:ring-1 focus:ring-coral/20 transition-all w-56 shadow-inner"
            />
            <div className="flex items-center gap-1 bg-surface-3 border border-border rounded-lg p-0.5">
              <button
                onClick={handleRenameSubmit}
                disabled={renameProject.isPending}
                className="flex items-center justify-center w-7 h-7 rounded-md text-teal hover:bg-teal/10 transition-colors cursor-pointer border-none bg-transparent">
                {renameProject.isPending ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
              </button>
              <button
                onClick={handleRenameCancel}
                className="flex items-center justify-center w-7 h-7 rounded-md text-text-tertiary hover:bg-border/50 hover:text-text-primary transition-colors cursor-pointer border-none bg-transparent">
                <X size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[14px] font-semibold text-text-primary truncate">
              {project.name}
            </span>
            {isConnected && (
              <div className="flex items-center gap-1.5 bg-teal/10 dark:bg-teal/15 border border-teal/20 px-2 py-0.5 rounded-full shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
                <span className="text-[9px] font-bold text-teal tracking-wider uppercase">
                  Active
                </span>
              </div>
            )}
          </div>
        )}

        {/* URI & Masking */}
        <div
          className="flex items-center gap-2 min-w-0"
          onClick={(e) => e.stopPropagation()}>
          <span className="text-[12px] text-text-tertiary font-mono truncate max-w-75 sm:max-w-100">
            {uriVisible ? project.uri : maskUri(project.uri)}
          </span>
          <button
            onClick={() => setUriVisible((v) => !v)}
            className="shrink-0 text-text-tertiary/50 hover:text-text-secondary hover:bg-surface-3 p-1 rounded-md transition-colors border-none bg-transparent cursor-pointer">
            {uriVisible ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
        </div>
      </div>

      {/* Metadata & Desktop Actions */}
      <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-64 shrink-0 mt-2 sm:mt-0">
        {/* Metadata (Fades out on hover to make room for actions) */}
        <div className="flex items-center gap-4 transition-all duration-200 sm:group-hover:opacity-0 sm:group-hover:translate-x-4">
          <ProviderBadge provider={project.provider} />
          <span className="flex items-center gap-1.5 text-[11px] text-text-tertiary font-medium">
            <Clock size={12} />
            {formatRelativeTime(project.lastOpenedAt)}
          </span>
        </div>

        {/* Action Buttons (Slide in on hover) */}
        <div
          className="flex sm:absolute sm:right-5 items-center gap-1.5 sm:opacity-0 sm:translate-x-4 sm:group-hover:opacity-100 sm:group-hover:translate-x-0 transition-all duration-200"
          onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center bg-surface-3 border border-border/60 rounded-lg p-0.5 shadow-sm">
            <button
              title="Rename project"
              onClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
              className="flex items-center justify-center w-8 h-8 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-1 transition-colors cursor-pointer border-none bg-transparent">
              <Pencil size={14} />
            </button>
            <div className="w-px h-4 bg-border/50 mx-0.5" />
            <button
              title="Delete project"
              onClick={handleDelete}
              disabled={deleteProject.isPending}
              className="flex items-center justify-center w-8 h-8 rounded-md text-text-tertiary hover:text-coral hover:bg-coral/10 transition-colors cursor-pointer border-none bg-transparent">
              {deleteProject.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
            </button>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpen();
            }}
            disabled={connect.isPending}
            className="flex items-center gap-1.5 px-4 h-9 ml-1 rounded-lg text-[12px] font-bold text-white bg-coral hover:bg-coral-hover hover:shadow-md hover:shadow-coral/20 transition-all cursor-pointer border-none disabled:opacity-60 active:scale-95">
            {connect.isPending ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              "Open Canvas"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const { data, isLoading } = useProjects();
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState<
    DatabaseProvider | "all"
  >("all");

  const connectedProjectId =
    typeof window !== "undefined"
      ? sessionStorage.getItem("nexusql_project_id")
      : null;

  const projects = useMemo(() => {
    let list = [...(data?.projects ?? [])].sort(
      (a, b) =>
        new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime(),
    );

    if (providerFilter !== "all") {
      list = list.filter((p) => p.provider === providerFilter);
    }

    if (search.trim()) {
      const needle = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          p.uri.toLowerCase().includes(needle),
      );
    }

    return list;
  }, [data, search, providerFilter]);

  const hasFilter = !!search.trim() || providerFilter !== "all";
  const totalCount = data?.projects?.length ?? 0;

  return (
    <>
      <TopNav />
      <main className="flex flex-col items-center min-h-screen pt-24 pb-16 px-4 sm:px-6 bg-surface-2 selection:bg-coral/20">
        <div className="w-full max-w-200 flex flex-col gap-8">
          {/* Header */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="flex items-center justify-center w-10 h-10 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-3 border border-transparent hover:border-border transition-all cursor-pointer bg-transparent">
              <ArrowLeft size={18} />
            </button>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-text-primary tracking-tight">
                Projects
              </h1>
              <span className="text-[12px] text-text-tertiary">
                Manage {totalCount} saved connection
                {totalCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-2.5 flex-1 h-10 px-3.5 rounded-xl border border-border bg-surface-1 focus-within:border-coral/50 focus-within:ring-2 focus-within:ring-coral/10 transition-all shadow-sm">
              <Search size={14} className="text-text-tertiary shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects or URIs…"
                className="flex-1 bg-transparent border-none outline-none text-[13px] font-mono text-text-primary placeholder:text-text-tertiary/70"
              />
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl border border-border bg-surface-1 shadow-sm overflow-x-auto no-scrollbar">
              {PROVIDER_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setProviderFilter(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold whitespace-nowrap transition-all cursor-pointer border-none ${
                    providerFilter === f.value
                      ? "bg-surface-3 text-text-primary shadow-sm"
                      : "bg-transparent text-text-tertiary hover:text-text-secondary hover:bg-surface-2"
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Data List */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-3 text-text-tertiary">
              <Loader2 size={24} className="animate-spin text-coral" />
              <span className="text-[13px] font-medium animate-pulse">
                Loading workspace...
              </span>
            </div>
          ) : projects.length === 0 ? (
            <EmptyState hasFilter={hasFilter} />
          ) : (
            <div className="rounded-2xl overflow-hidden border border-border/80 bg-surface-1 shadow-sm">
              {projects.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  isConnected={project.id === connectedProjectId}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
