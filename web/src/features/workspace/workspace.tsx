"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileCode2, Network, Sprout, Table2 } from "lucide-react";
import { CanvasStudio } from "@/features/canvas";
import { SqlDock } from "@/features/console";
import { ExportView } from "@/features/export";
import { SeedDataModal } from "@/features/seed";
import { useSchema } from "@/shared/hooks/use-schema";
import { cx } from "@/shared/lib/cx";
import { Button } from "@/shared/ui/button";
import { TabPanel, Tabs } from "@/shared/ui/tabs";
import { ToastProvider } from "@/shared/ui/toast";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { DataView } from "./_components/data-view";
import { RelationshipTrail } from "./_components/relationship-trail";
import { TablesSidebar } from "./_components/tables-sidebar";
import { TopBar } from "./_components/top-bar";
import { EMPTY_TRAIL, stepTrail } from "./lib/trail";
import { nextSearch, parseView, selectTableUpdates, type Updates } from "./lib/workspace-url";

const VIEW_TABS = [
  { id: "diagram", label: "Diagram", icon: <Network aria-hidden /> },
  { id: "data", label: "Data", icon: <Table2 aria-hidden /> },
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
  const relations = schema?.relations ?? [];
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
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setDockOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const selectTable = useCallback((name: string | null) => go(name ? selectTableUpdates(name) : { table: null }), [go]);

  return (
    <div
      className={cx(
        "grid h-screen grid-rows-[auto_3rem_minmax(0,1fr)_auto] bg-ground text-body text-fg",
        collapsed ? "grid-cols-[3.25rem_minmax(0,1fr)]" : "grid-cols-[16.5rem_minmax(0,1fr)]",
      )}>
      <TopBar />
      <TablesSidebar
        tables={schema?.tables ?? []}
        relations={relations}
        selected={table}
        onSelect={selectTable}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
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
      </div>
      <TabPanel idPrefix={TABS_ID} id={view} className="relative min-h-0 overflow-hidden">
        {view === "diagram" && <CanvasStudio selectedTable={table} onSelectTable={selectTable} />}
        {view === "data" && <DataView table={table} />}
        {view === "export" && <ExportView format={params.get("format")} onFormatChange={(f) => go({ format: f })} />}
      </TabPanel>
      <SqlDock open={dockOpen} onOpenChange={setDockOpen} />
      <SeedDataModal open={seedOpen} onClose={() => setSeedOpen(false)} />
    </div>
  );
}
