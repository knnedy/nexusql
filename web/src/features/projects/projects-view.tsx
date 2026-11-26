"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, MoreHorizontal, Network, Pencil, Plus, Search, Table2, Trash2, X } from "lucide-react";
import { AppBar } from "@/components/app-bar";
import { LocalNotes } from "@/components/local-notes";
import { useConnect } from "@/features/connect/hooks/use-connect";
import { useDeleteProject, useProjects, useRenameProject } from "@/shared/hooks/use-projects";
import { cx } from "@/shared/lib/cx";
import { studioSession } from "@/shared/lib/session-storage";
import { formatRelativeTime } from "@/shared/lib/utils";
import type { Project } from "@/shared/types/project";
import { PROVIDERS } from "@/shared/types/provider";
import { Button, IconButton } from "@/shared/ui/button";
import { Dialog, DialogContent } from "@/shared/ui/dialog";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
import { Kbd } from "@/shared/ui/kbd";
import { Menu, MenuContent, MenuItem, MenuSeparator } from "@/shared/ui/menu";
import { ProviderMark } from "@/shared/ui/provider-mark";
import { Skeleton } from "@/shared/ui/surface";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { countByProvider, visibleProjects, type ProviderFilter } from "./lib/project-list";

const FILTERS: { id: ProviderFilter; label: string }[] = [{ id: "all", label: "All" }, ...PROVIDERS.map((p) => ({ id: p.id, label: p.label }))];
const label = (p: Project) => PROVIDERS.find((x) => x.id === p.provider)?.label ?? p.provider;

function ProjectRow({ project, connected, onDelete }: { project: Project; connected: boolean; onDelete: (p: Project) => void }) {
  const router = useRouter();
  const connect = useConnect();
  const rename = useRenameProject();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.name);

  function open(view: "diagram" | "data") {
    connect.mutate({ projectId: project.id, name: project.name }, { onSuccess: () => router.push(`/studio/?view=${view}`) });
  }
  function save() {
    const next = draft.trim();
    if (!next || next === project.name) {
      setEditing(false);
      setDraft(project.name);
      return;
    }
    rename.mutate({ id: project.id, name: next }, { onSuccess: () => setEditing(false) });
  }

  return (
    <li
      className={cx(
        "group relative grid min-h-16 grid-cols-[2.25rem_minmax(0,1fr)_6rem_6rem] items-center gap-3.5 border-t border-line pr-3 pl-3.5 first:border-t-0 focus-within:bg-sunk hover:bg-sunk",
        connected && "shadow-[inset_3px_0_0_var(--nx-relation-line)]",
      )}>
      <span className="grid size-9 place-items-center rounded-card border border-line bg-sunk">
        <ProviderMark provider={project.provider} size={20} />
      </span>

      <div className="min-w-0">
        {editing ? (
          <div className="flex items-center gap-1">
            <Input
              aria-label="Project name"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") {
                  setEditing(false);
                  setDraft(project.name);
                }
              }}
              wrapperClassName="h-7.5 max-w-72"
            />
            <IconButton label="Save name" size="sm" onClick={save} disabled={rename.isPending}>
              <Check aria-hidden />
            </IconButton>
            <IconButton
              label="Cancel"
              size="sm"
              onClick={() => {
                setEditing(false);
                setDraft(project.name);
              }}>
              <X aria-hidden />
            </IconButton>
          </div>
        ) : (
          // The name opens the diagram; the row's other buttons sit outside it.
          <button
            type="button"
            onClick={() => open("diagram")}
            className="block max-w-full cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent after:absolute after:inset-0">
            <span className="flex items-center gap-2">
              <span className="truncate text-title font-semibold">{project.name}</span>
              {connected && (
                <span className="inline-flex h-5 shrink-0 items-center gap-1.25 rounded-full bg-relation-tint px-1.75 text-caption font-medium text-relation">
                  <span aria-hidden className="size-1.5 rounded-full bg-relation-line" />
                  Connected
                </span>
              )}
            </span>
            <span className="mt-0.5 block truncate font-mono text-label text-fg-subtle">{project.displayUri}</span>
          </button>
        )}
      </div>

      <span className="text-label text-fg-muted">{label(project)}</span>
      <span className="text-label text-fg-subtle">{formatRelativeTime(project.lastOpenedAt)}</span>

      {/* Over the database and date columns, shown on hover or focus. */}
      <div className="absolute top-1/2 right-3 z-10 flex -translate-y-1/2 items-center gap-1 bg-sunk pl-3 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 has-data-popup-open:opacity-100">
        <Button size="sm" variant="ghost" onClick={() => open("diagram")} disabled={connect.isPending}>
          <Network aria-hidden />
          Diagram
        </Button>
        <Button size="sm" variant="ghost" onClick={() => open("data")} disabled={connect.isPending}>
          <Table2 aria-hidden />
          Data
        </Button>
        <Menu.Root>
          <Menu.Trigger
            aria-label={`More for ${project.name}`}
            className="grid size-7 cursor-pointer place-items-center rounded-control text-fg-muted hover:bg-sunk hover:text-fg focus-visible:outline-2 focus-visible:outline-accent data-popup-open:bg-sunk">
            <MoreHorizontal aria-hidden className="size-3.75" />
          </Menu.Trigger>
          <MenuContent align="end">
            <MenuItem icon={<Pencil aria-hidden />} onClick={() => setEditing(true)}>
              Rename
            </MenuItem>
            <MenuSeparator />
            <MenuItem danger icon={<Trash2 aria-hidden />} onClick={() => onDelete(project)}>
              Delete…
            </MenuItem>
          </MenuContent>
        </Menu.Root>
      </div>
      {connect.isError && (
        <p role="alert" className="col-span-full -mt-1 mb-2.5 text-label text-danger">
          {connect.error instanceof Error ? connect.error.message : "Could not open this project."}
        </p>
      )}
    </li>
  );
}

export default function ProjectsView() {
  const { data, isLoading } = useProjects();
  const remove = useDeleteProject();
  const router = useRouter();
  const params = useSearchParams();
  // The filter lives in the URL, so a reload or a shared link keeps it.
  const [search, setSearch] = useState(params.get("q") ?? "");
  const db = params.get("db");
  const provider: ProviderFilter = FILTERS.some((f) => f.id === db) ? (db as ProviderFilter) : "all";
  function setUrl(q: string, next: ProviderFilter) {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q);
    if (next !== "all") sp.set("db", next);
    router.replace(`/projects/${sp.size ? `?${sp}` : ""}`, { scroll: false });
  }
  const [deleting, setDeleting] = useState<Project | null>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const all = useMemo(() => data?.projects ?? [], [data]);
  const shown = useMemo(() => visibleProjects(all, search, provider), [all, search, provider]);
  const counts = countByProvider(all);
  const connectedId = studioSession.projectId();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(t.tagName)) {
        e.preventDefault();
        filterRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-ground text-body text-fg">
        <AppBar />
        <main id="main" className="mx-auto w-full max-w-220 px-4 pt-9 pb-16 sm:px-8">
          <section aria-labelledby="projects-title" className="min-w-0">
            <div className="mb-4.5 flex flex-wrap items-end gap-3">
              <div className="flex-1">
                <h1 id="projects-title" className="text-display font-semibold tracking-tight text-balance">
                  Projects
                  {all.length > 0 && <span className="ml-2 text-subheading font-medium text-fg-subtle tabular-nums">{all.length}</span>}
                </h1>
                <p className="mt-1 text-body text-fg-muted">Saved connections. Pick one to open its diagram.</p>
              </div>
              <Link
                href="/"
                className="inline-flex h-7.5 items-center gap-1.75 rounded-control bg-accent-fill px-3 text-body font-medium text-on-accent transition-transform duration-150 ease-out-strong hover:bg-accent-fill/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-97">
                <Plus aria-hidden className="size-3.75" />
                New connection
              </Link>
            </div>

            {all.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2.5">
                <Input
                  ref={filterRef}
                  aria-label="Filter projects"
                  placeholder="Filter by name or address"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setUrl(e.target.value, provider);
                  }}
                  leading={<Search aria-hidden />}
                  trailing={<Kbd>/</Kbd>}
                  wrapperClassName="w-full max-w-85 bg-panel"
                />
                <div role="group" aria-label="Database" className="inline-flex gap-0.5 rounded-card border border-line bg-sunk p-0.5">
                  {FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={provider === f.id}
                      onClick={() => setUrl(search, f.id)}
                      className="inline-flex h-6.5 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-label font-medium text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-accent aria-pressed:bg-panel aria-pressed:text-fg aria-pressed:shadow-sm">
                      {f.label}
                      <span className="font-normal text-fg-subtle tabular-nums">{counts[f.id]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="grid gap-2">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : all.length === 0 ? (
              <EmptyState
                className="rounded-panel border border-dashed border-line-strong py-14"
                title="No projects yet"
                action={
                  <Link href="/" className="text-body font-medium text-accent hover:underline">
                    Connect a database
                  </Link>
                }>
                A project is a saved connection. Connect once and it appears here.
              </EmptyState>
            ) : shown.length === 0 ? (
              <p className="rounded-panel border border-line bg-panel px-4 py-8 text-center text-body text-fg-subtle">
                No project matches{search.trim() ? ` “${search.trim()}”` : ""}
                {provider !== "all" ? ` among ${FILTERS.find((f) => f.id === provider)?.label} projects` : ""}.
              </p>
            ) : (
              <>
                <ul aria-label="Projects" className="overflow-hidden rounded-panel border border-line-strong bg-panel">
                  {shown.map((p) => (
                    <ProjectRow key={p.id} project={p} connected={p.id === connectedId} onDelete={setDeleting} />
                  ))}
                </ul>
                <p className="mt-2.5 px-1 text-label text-fg-subtle">Most recently opened first.</p>
              </>
            )}
          </section>

          <LocalNotes />
        </main>

        <Dialog.Root open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
          <DialogContent
            title={`Delete ${deleting?.name ?? "project"}?`}
            description="This removes the saved connection from NexusQL. The database and its data are not touched."
            footer={
              <>
                <Dialog.Close render={<Button variant="secondary" />}>Cancel</Dialog.Close>
                <Button
                  variant="danger"
                  disabled={remove.isPending}
                  onClick={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}>
                  Delete project
                </Button>
              </>
            }
          />
        </Dialog.Root>
      </div>
    </TooltipProvider>
  );
}
