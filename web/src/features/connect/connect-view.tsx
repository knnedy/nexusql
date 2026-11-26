"use client";

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, FolderOpen, Link2, Loader2 } from "lucide-react";
import { AppBar } from "@/components/app-bar";
import { LocalNotes } from "@/components/local-notes";
import { useProjects } from "@/shared/hooks/use-projects";
import { cx } from "@/shared/lib/cx";
import { studioSession } from "@/shared/lib/session-storage";
import { formatRelativeTime } from "@/shared/lib/utils";
import { PROVIDERS, type DatabaseProvider } from "@/shared/types/provider";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ProviderMark } from "@/shared/ui/provider-mark";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { useConnect } from "./hooks/use-connect";
import { detectProvider, validateConnection, type ConnectionErrors } from "./lib/connection-form";

const EXAMPLES: { label: string; provider: DatabaseProvider; uri: string }[] = [
  { label: "Postgres in Docker", provider: "postgres", uri: "postgres://postgres:postgres@localhost:5432/postgres" },
  { label: "MySQL on this machine", provider: "mysql", uri: "mysql://root:password@127.0.0.1:3306/app" },
  { label: "SQLite file", provider: "sqlite", uri: "sqlite:///absolute/path/to/app.db" },
];

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: ReactNode; children: (ids: { id: string; describedBy?: string }) => ReactNode }) {
  const id = useId();
  const note = `${id}-note`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-label font-medium text-fg-muted">
        {label}
      </label>
      {children({ id, describedBy: error || hint ? note : undefined })}
      {error ? (
        <p id={note} className="mt-1.5 text-label text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={note} className="mt-1.5 text-label text-fg-subtle">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export default function ConnectView() {
  const [provider, setProvider] = useState<DatabaseProvider>("postgres");
  const [name, setName] = useState("");
  const [uri, setUri] = useState("");
  const [errors, setErrors] = useState<ConnectionErrors>({});
  const [createNew, setCreateNew] = useState(false);
  const connect = useConnect();
  const { data, isLoading } = useProjects();
  const projects = data?.projects ?? [];
  const recent = [...projects].sort((a, b) => Date.parse(b.lastOpenedAt) - Date.parse(a.lastOpenedAt)).slice(0, 3);
  const meta = PROVIDERS.find((p) => p.id === provider)!;

  function changeUri(value: string) {
    setUri(value);
    setErrors((e) => ({ ...e, uri: undefined }));
    const detected = detectProvider(value);
    if (detected) setProvider(detected);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const found = validateConnection({ name, uri, provider });
    setErrors(found);
    if (found.name || found.uri) return;
    studioSession.setProjectName(name.trim());
    connect.mutate({ uri, provider, name: name.trim(), ...(provider === "sqlite" && createNew && { create: true }) });
  }

  const firstRun = !isLoading && projects.length === 0;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-ground text-body text-fg">
        <AppBar>
          {projects.length > 0 && (
            <Link
              href="/projects"
              className="inline-flex h-7.5 items-center gap-1.75 rounded-control px-3 text-body font-medium text-fg-muted hover:bg-sunk hover:text-fg focus-visible:outline-2 focus-visible:outline-accent">
              <FolderOpen aria-hidden className="size-3.75" />
              Projects
            </Link>
          )}
        </AppBar>

        <main className="mx-auto w-full max-w-115 px-4 pt-16 pb-16">
          <h1 className="text-display font-semibold tracking-tight">{firstRun ? "Connect a database" : "New connection"}</h1>
          <p className="mt-2 mb-6 max-w-100 text-title text-fg-muted">
            Paste a connection string. NexusQL reads the schema and draws how the tables relate; nothing leaves this machine.
          </p>

          <form noValidate onSubmit={submit} aria-label="New connection" className="grid gap-4 rounded-panel border border-line-strong bg-panel p-4.5 shadow-card">
            <div>
              <p className="mb-1.5 text-label font-medium text-fg-muted" id="database-label">
                Database
              </p>
              <div role="group" aria-labelledby="database-label" className="grid grid-cols-3 gap-1.5">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={provider === p.id}
                    onClick={() => {
                      setProvider(p.id);
                      setErrors((e) => ({ ...e, uri: undefined }));
                    }}
                    className={cx(
                      "flex cursor-pointer flex-col items-start gap-2 rounded-card border px-2.5 pt-2.5 pb-2 text-left transition-[border-color,background-color,transform] duration-150 ease-out-strong active:scale-97",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                      provider === p.id ? "border-accent-line bg-accent-tint ring-1 ring-accent-line" : "border-line hover:border-line-strong",
                    )}>
                    <ProviderMark provider={p.id} size={20} />
                    <span className="text-label font-semibold">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Field label="Project name" error={errors.name}>
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={!!errors.name}
                  wrapperClassName="h-8.5"
                  placeholder="shop_dev"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setErrors((er) => ({ ...er, name: undefined }));
                  }}
                />
              )}
            </Field>

            <Field label="Connection URI" error={errors.uri} hint={<>Often in your app&apos;s <code className="font-mono text-caption">.env</code> as <code className="font-mono text-caption">DATABASE_URL</code>.</>}>
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={!!errors.uri}
                  wrapperClassName="h-8.5"
                  className="font-mono text-label"
                  leading={<Link2 aria-hidden />}
                  placeholder={meta.uriPlaceholder}
                  spellCheck={false}
                  autoComplete="off"
                  value={uri}
                  onChange={(e) => changeUri(e.target.value)}
                />
              )}
            </Field>

            {provider === "sqlite" && (
              // Opening never creates a file, so a mistyped path cannot start an empty database.
              <label className="flex cursor-pointer items-start gap-2.5 text-body">
                <input type="checkbox" checked={createNew} onChange={(e) => setCreateNew(e.target.checked)} className="mt-0.5 size-3.75 accent-(--nx-accent-fill)" />
                <span>
                  Create a new database file
                  <span className="block text-label text-fg-subtle">Off: the file must already exist, so a typo can&apos;t start an empty database.</span>
                </span>
              </label>
            )}

            {connect.isError && (
              <p role="alert" className="rounded-control border border-danger/40 bg-danger-tint px-3 py-2 text-label text-danger">
                {connect.error instanceof Error ? connect.error.message : "Could not connect."}
              </p>
            )}

            <Button type="submit" variant="primary" className="h-9 text-title" disabled={connect.isPending}>
              {connect.isPending ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {connect.isPending ? "Connecting…" : "Connect"}
              {!connect.isPending && <ArrowRight aria-hidden />}
            </Button>
          </form>

          {recent.length > 0 && (
            <section aria-label="Recent projects" className="mt-6">
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-label font-medium text-fg-subtle">Recent projects</h2>
                <Link href="/projects" className="text-label font-medium text-accent hover:underline">
                  All projects
                </Link>
              </div>
              <ul className="overflow-hidden rounded-card border border-line bg-panel">
                {recent.map((p) => (
                  <li key={p.id} className="border-t border-line first:border-t-0">
                    <button
                      type="button"
                      onClick={() => connect.mutate({ projectId: p.id, name: p.name })}
                      className="grid w-full cursor-pointer grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-left hover:bg-sunk focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
                      <ProviderMark provider={p.provider} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p.name}</span>
                        <span className="block truncate font-mono text-caption text-fg-subtle">{p.displayUri}</span>
                      </span>
                      <span className="text-label text-fg-subtle">{formatRelativeTime(p.lastOpenedAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {firstRun && (
            <section aria-label="Examples" className="mt-6">
              <h2 className="mb-2 px-1 text-label font-medium text-fg-subtle">Examples to start from</h2>
              <div className="grid gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.label}
                    type="button"
                    onClick={() => changeUri(ex.uri)}
                    className="flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-card border border-dashed border-line-strong px-3 py-2 text-left hover:border-solid hover:bg-panel focus-visible:outline-2 focus-visible:outline-accent">
                    <span className="w-36 shrink-0 text-label text-fg-muted">{ex.label}</span>
                    <code className="min-w-0 truncate font-mono text-label">{ex.uri}</code>
                  </button>
                ))}
              </div>
            </section>
          )}

          <LocalNotes />
        </main>
      </div>
    </TooltipProvider>
  );
}
