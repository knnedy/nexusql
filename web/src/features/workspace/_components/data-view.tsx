"use client";

import { Table2 } from "lucide-react";
import { ExplorerStudio } from "@/features/explorer";
import { EmptyState } from "@/shared/ui/empty-state";

/** The selected table's rows; asks for a table when none is chosen. */
export function DataView({ table }: { table: string | null }) {
  if (!table) {
    return (
      <div className="grid h-full place-items-center">
        <EmptyState icon={<Table2 aria-hidden />} title="Pick a table">
          Choose a table in the sidebar to browse and edit its rows.
        </EmptyState>
      </div>
    );
  }
  return <ExplorerStudio key={table} />;
}
