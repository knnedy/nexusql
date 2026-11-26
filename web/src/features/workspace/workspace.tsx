"use client";

import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Network, Table2 } from "lucide-react";
import { CanvasStudio } from "@/features/canvas";
import { useSchema } from "@/shared/hooks/use-schema";
import { cx } from "@/shared/lib/cx";
import { TabPanel, Tabs } from "@/shared/ui/tabs";
import { ToastProvider } from "@/shared/ui/toast";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { DataView } from "./_components/data-view";
import { TablesSidebar } from "./_components/tables-sidebar";
import { TopBar } from "./_components/top-bar";
import { nextSearch, parseView, selectTableUpdates, type Updates } from "./lib/workspace-url";

const VIEW_TABS = [
  { id: "diagram", label: "Diagram", icon: <Network aria-hidden /> },
  { id: "data", label: "Data", icon: <Table2 aria-hidden /> },
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

  const go = useCallback(
    (updates: Updates) => router.replace(`/studio/?${nextSearch(params, updates)}`, { scroll: false }),
    [router, params],
  );
  const selectTable = useCallback((name: string | null) => go(name ? selectTableUpdates(name) : { table: null }), [go]);

  return (
    <div
      className={cx(
        "grid h-screen grid-rows-[auto_3rem_minmax(0,1fr)] bg-ground text-body text-fg",
        collapsed ? "grid-cols-[3.25rem_minmax(0,1fr)]" : "grid-cols-[16.5rem_minmax(0,1fr)]",
      )}>
      <TopBar />
      <TablesSidebar
        tables={schema?.tables ?? []}
        relations={schema?.relations ?? []}
        selected={table}
        onSelect={selectTable}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />
      <div className="flex items-stretch gap-3.5 border-b border-line bg-panel px-4">
        <Tabs label="View" idPrefix={TABS_ID} items={VIEW_TABS} value={view} onChange={(v) => go({ view: v })} />
      </div>
      <TabPanel idPrefix={TABS_ID} id={view} className="relative min-h-0 overflow-hidden">
        {view === "diagram" ? <CanvasStudio selectedTable={table} onSelectTable={selectTable} /> : <DataView table={table} />}
      </TabPanel>
    </div>
  );
}
