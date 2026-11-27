"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { FileCode2, ListTree, Network, PanelRight, Sprout, Table2 } from "lucide-react";
import { CanvasStudio } from "@/features/canvas";
import { SqlDock } from "@/features/console";
import { ExportView, parseInclude } from "@/features/export";
import { SeedDialog } from "@/features/seed";
import { useSchema } from "@/shared/hooks/use-schema";
import { cx } from "@/shared/lib/cx";
import { Button } from "@/shared/ui/button";
import { TabPanel, Tabs } from "@/shared/ui/tabs";
import { ToastProvider } from "@/shared/ui/toast";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { DataView } from "./_components/data-view";
import { RelationshipTrail } from "./_components/relationship-trail";
import { SearchPanel } from "./_components/search-panel";
import { StructureView } from "./_components/structure-view";
import { TablesSidebar } from "./_components/tables-sidebar";
import { TopBar } from "./_components/top-bar";
import type { SearchItem } from "./lib/search";
import { shortcutFor } from "./lib/shortcuts";
import { EMPTY_TRAIL, stepTrail } from "./lib/trail";
import { nextSearch, parseView, selectTableUpdates, type Updates } from "./lib/workspace-url";

const VIEW_TABS = [
  { id: "diagram", label: "Diagram", icon: <Network aria-hidden /> },
  { id: "data", label: "Data", icon: <Table2 aria-hidden /> },
  { id: "structure", label: "Structure", icon: <ListTree aria-hidden /> },
  { id: "export", label: "Export", icon: <FileCode2 aria-hidden /> },
];
const TABS_ID = "workspace-view";

/** One workspace for a connected database; the view and table live in the URL. */
export default function Workspace() {
  return (
    <TooltipProvider>
      <ToastProvider>
        <Suspense fallback={null}>
          <WorkspaceInner />
        </Suspense>
      </ToastProvider>
    </TooltipProvider>
  );
}

function WorkspaceInner() {
  const router = useRouter();
  const params = useSearchParams();
  const view = parseView(params.get("view"));
  const table = params.get("table");
  const { data: schema } = useSchema();
  const [collapsed, setCollapsed] = useState(false);
  const [dockOpen, setDockOpen] = useState(false);
  const [seedOpen, setSeedOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const filterRef = useRef<HTMLInputElement>(null);
  const { resolvedTheme, setTheme } = useTheme();
  const relations = schema?.relations ?? [];
  const tableNames = useMemo(() => (schema?.tables ?? []).map((t) => t.name), [schema]);
  // The trail follows the URL's table, however it was chosen.
  const [trail, setTrail] = useState(EMPTY_TRAIL);
  const [trailFor, setTrailFor] = useState<string | null>(null);
  if (table !== trailFor) {
    setTrailFor(table);
    setTrail(stepTrail(trail, table, relations));
  }

  const go = useCallback(
    (updates: Updates) => router.replace(`/studio/?${nextSearch(params, updates)}`, { scroll: false }),
    [router, params],
  );
  const focusFilter = useCallback(() => {
    setCollapsed(false);
    requestAnimationFrame(() => filterRef.current?.focus());
  }, []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const shortcut = shortcutFor(e);
      if (!shortcut) return;
      e.preventDefault();
      if (shortcut === "search") setSearchOpen((o) => !o);
      if (shortcut === "sidebar") setCollapsed((c) => !c);
      if (shortcut === "sql") setDockOpen((o) => !o);
      if (shortcut === "filter") focusFilter();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusFilter]);
  const selectTable = useCallback((name: string | null) => go(name ? selectTableUpdates(name) : { table: null }), [go]);

  const searchItems = useMemo<SearchItem[]>(() => {
    const tables = [...(schema?.tables ?? [])].sort((a, b) => a.name.localeCompare(b.name));
    return [
      ...tables.map((t): SearchItem => ({ id: `table:${t.name}`, kind: "table", label: t.name, detail: `${t.fields.length} columns` })),
      ...VIEW_TABS.map((v): SearchItem => ({ id: `view:${v.id}`, kind: "view", label: v.label, keywords: "view tab" })),
      { id: "action:sql", kind: "action", label: "Toggle SQL console", detail: "Ctrl J", keywords: "query run" },
      { id: "action:sidebar", kind: "action", label: "Toggle tables sidebar", detail: "Ctrl B", keywords: "hide show" },
      { id: "action:seed", kind: "action", label: "Seed data", keywords: "generate fake rows" },
      { id: "action:theme", kind: "action", label: "Switch theme", keywords: "dark light mode" },
      { id: "action:projects", kind: "action", label: "All projects", keywords: "switch project connection" },
      ...tables.flatMap((t) =>
        t.fields.map((f): SearchItem => ({ id: `column:${t.name}.${f.name}`, kind: "column", label: f.name, detail: t.name })),
      ),
    ];
  }, [schema]);

  function runSearch(item: SearchItem) {
    const [kind, rest] = [item.id.slice(0, item.id.indexOf(":")), item.id.slice(item.id.indexOf(":") + 1)];
    if (kind === "table") selectTable(rest);
    else if (kind === "column") selectTable(item.detail ?? null);
    else if (kind === "view") go({ view: rest });
    else if (rest === "sql") setDockOpen((o) => !o);
    else if (rest === "sidebar") setCollapsed((c) => !c);
    else if (rest === "seed") setSeedOpen(true);
    else if (rest === "theme") setTheme(resolvedTheme === "dark" ? "light" : "dark");
    else if (rest === "projects") router.push("/projects");
  }

  return (
    <div
      className={cx(
        "grid h-screen grid-rows-[auto_3rem_minmax(0,1fr)_auto] bg-ground text-body text-fg",
        collapsed ? "grid-cols-[3.25rem_minmax(0,1fr)]" : "grid-cols-[16.5rem_minmax(0,1fr)]",
      )}>
      <TopBar onSearch={() => setSearchOpen(true)} />
      <TablesSidebar
        tables={schema?.tables ?? []}
        relations={relations}
        selected={table}
        onSelect={selectTable}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        filterRef={filterRef}
        footer={
          <Button variant="ghost" className="justify-start" onClick={() => setSeedOpen(true)}>
            <Sprout aria-hidden />
            Seed data
          </Button>
        }
      />
      <div className="flex min-w-0 items-stretch gap-3.5 border-b border-line bg-panel px-4">
        <RelationshipTrail trail={trail} relations={relations} onSelect={selectTable} />
        <Tabs label="View" idPrefix={TABS_ID} items={VIEW_TABS} value={view} onChange={(v) => go({ view: v })} />
        {view === "diagram" && (
          <Button size="sm" variant="ghost" className="ml-auto self-center aria-pressed:bg-sunk aria-pressed:text-fg" aria-pressed={detailsOpen} onClick={() => setDetailsOpen((o) => !o)}>
            <PanelRight aria-hidden />
            Details
          </Button>
        )}
      </div>
      <TabPanel idPrefix={TABS_ID} id={view} className="relative min-h-0 overflow-hidden">
        {view === "diagram" && (
          <CanvasStudio
            selectedTable={table}
            onSelectTable={selectTable}
            detailsOpen={detailsOpen}
            onCloseDetails={() => setDetailsOpen(false)}
            onOpenData={(name) => go({ ...selectTableUpdates(name), view: "data" })}
          />
        )}
        {view === "data" && <DataView table={table} />}
        {view === "structure" && (
          <StructureView
            table={table}
            tables={schema?.tables ?? []}
            relations={relations}
            onSelectTable={selectTable}
            onOpenData={(name) => go({ ...selectTableUpdates(name), view: "data" })}
            hrefFor={(name) => `/studio/?${nextSearch(params, selectTableUpdates(name))}`}
          />
        )}
        {view === "export" && (
          <ExportView
            format={params.get("format")}
            onFormatChange={(f) => go({ format: f })}
            schema={schema}
            table={table}
            include={parseInclude(params.get("include"))}
            onIncludeChange={(i) => go({ include: i === "all" ? null : i })}
          />
        )}
      </TabPanel>
      <SqlDock open={dockOpen} onOpenChange={setDockOpen} tables={tableNames} />
      <SeedDialog
        open={seedOpen}
        onClose={() => setSeedOpen(false)}
        schema={schema}
        table={table}
        onOpenData={(name) => go({ ...selectTableUpdates(name), view: "data" })}
      />
      <SearchPanel open={searchOpen} onOpenChange={setSearchOpen} items={searchItems} onRun={runSearch} />
    </div>
  );
}
