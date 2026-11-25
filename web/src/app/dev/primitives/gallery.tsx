"use client";

import { useState, type ReactNode } from "react";
import { Download, Network, Play, Plus, Search, Table2, TableProperties, FileCode, PanelRight, Inbox } from "lucide-react";
import { Button, IconButton } from "@/shared/ui/button";
import { Badge, FilterChip } from "@/shared/ui/chip";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
import { Kbd } from "@/shared/ui/kbd";
import { FloatCard, Skeleton } from "@/shared/ui/surface";
import { Tabs } from "@/shared/ui/tabs";

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-[10px] border-b border-line py-[20px]">
      <h2 className="text-label font-medium text-fg-subtle">{title}</h2>
      <div className="flex flex-wrap items-center gap-[10px]">{children}</div>
    </section>
  );
}

export function Gallery() {
  const [view, setView] = useState("diagram");
  return (
    <main className="min-h-screen bg-ground px-[32px] py-[24px] text-body text-fg">
      <h1 className="text-heading font-semibold">Primitives</h1>
      <Row title="Buttons">
        <Button variant="primary"><Play aria-hidden />Run</Button>
        <Button><Download aria-hidden />CSV</Button>
        <Button variant="ghost">History</Button>
        <Button variant="danger">Delete row</Button>
        <Button variant="primary" size="sm"><Plus aria-hidden />Row</Button>
        <Button disabled>Disabled</Button>
        <IconButton label="Toggle details"><PanelRight aria-hidden /></IconButton>
      </Row>
      <Row title="Tabs">
        <div className="h-[48px] border-b border-line bg-panel px-[8px]">
          <Tabs label="View" value={view} onChange={setView} items={[
            { id: "diagram", label: "Diagram", icon: <Network aria-hidden /> },
            { id: "data", label: "Data", icon: <Table2 aria-hidden /> },
            { id: "structure", label: "Structure", icon: <TableProperties aria-hidden /> },
            { id: "export", label: "Export", icon: <FileCode aria-hidden /> },
          ]} />
        </div>
      </Row>
      <Row title="Inputs and keys">
        <Input aria-label="Filter tables" placeholder="Filter tables" leading={<Search aria-hidden />} trailing={<Kbd>/</Kbd>} wrapperClassName="w-[240px]" />
        <Input aria-label="Value" placeholder="Value" wrapperClassName="w-[180px]" />
        <span className="flex items-center gap-[4px] text-label text-fg-muted"><Kbd>Ctrl</Kbd><Kbd>K</Kbd> search</span>
      </Row>
      <Row title="Chips and badges">
        <FilterChip removeLabel="Remove filter status is paid" onRemove={() => {}}><b>status</b> is <b>paid</b></FilterChip>
        <Badge>INDEX</Badge><Badge tone="accent">PK</Badge><Badge tone="relation">FK</Badge><Badge tone="warn">pending</Badge><Badge tone="danger">error</Badge>
      </Row>
      <Row title="Surfaces">
        <FloatCard className="w-[304px] p-[16px]">
          <p className="text-heading font-semibold">orders</p>
          <p className="text-label text-fg-subtle">Commerce · 6 columns</p>
        </FloatCard>
        <div className="flex w-[240px] flex-col gap-[8px]"><Skeleton className="h-[14px] w-3/4" /><Skeleton className="h-[14px]" /><Skeleton className="h-[14px] w-1/2" /></div>
      </Row>
      <Row title="Empty state">
        <div className="w-[420px] rounded-card border border-line bg-panel">
          <EmptyState icon={<Inbox aria-hidden />} title="No rows yet" action={<Button variant="primary"><Plus aria-hidden />Add a row</Button>}>
            orders has no rows. Add one, or fill every table with sample data.
          </EmptyState>
        </div>
      </Row>
    </main>
  );
}
