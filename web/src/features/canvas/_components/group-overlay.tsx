"use client";

import { useViewportStore, ViewportPortal, type Node } from "@xyflow/react";
import type { GroupNodeData } from "@/features/canvas/types";
import { detailAt, routeLinks, type GroupLink } from "@/features/canvas/lib/overview";
import { GROUP_LABEL } from "@/features/canvas/lib/canvas-utils";

// The name pill's height and inset, in pixels before scaling.
const LABEL_H = 28;
const LABEL_INSET = 12;
// On-screen widths: the least a name gets, and what a region needs to also show its count.
const MIN_NAME = 64;
const ROOM_FOR_COUNT = 100;

// Readable at any zoom: counter-scaled to a constant size on screen.
const PILL = "inline-flex items-baseline gap-1.5 whitespace-nowrap rounded-full border border-line-strong bg-raised shadow-card";

/** Zoomed out: group names and one connector per pair of linked groups, drawn above the cards. */
export function GroupOverlay({ groups, links }: { groups: Node<GroupNodeData>[]; links: GroupLink[] }) {
  const zoom = useViewportStore((s) => s.transform[2]);
  const detail = detailAt(zoom);
  if (detail === "full") return null;
  const k = 1 / zoom;
  // While cards show text the name stays inside its band; as blocks it may cover them.
  const nameScale = detail === "keys" ? Math.min(k, (GROUP_LABEL - 2 * LABEL_INSET) / LABEL_H) : k;
  const box = new Map(groups.map((g) => [g.id, { x: g.position.x, y: g.position.y, w: g.width ?? 0, h: g.height ?? 0 }]));
  const lines = routeLinks(links, box);
  return (
    <ViewportPortal>
      <svg className="pointer-events-none absolute top-0 left-0 overflow-visible" aria-hidden>
        {lines.map((l) => (
          <polyline
            key={`${l.a}|${l.b}`}
            points={l.points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="var(--nx-line-strong)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {detail === "keys" && lines.map((l) => (
        <span
          key={`${l.a}|${l.b}`}
          title={l.title}
          style={{ left: l.chip.x, top: l.chip.y, transform: `translate(-50%, -50%) scale(${k})` }}
          className={`${PILL} absolute px-2 py-0.5 text-caption text-fg-muted tabular-nums`}>
          {l.count === 1 ? "1 link" : `${l.count} links`}
        </span>
      ))}
      {groups.map((g) => {
        // On screen, a small region's name may run past it a little rather than vanish.
        const room = ((g.width ?? 0) - 2 * LABEL_INSET) * zoom;
        return (
          <div
            key={g.id}
            style={{
              left: g.position.x + LABEL_INSET,
              top: g.position.y + LABEL_INSET,
              transform: `scale(${nameScale})`,
              maxWidth: Math.max(room, MIN_NAME) / (nameScale * zoom),
            }}
            translate="no"
            className="pointer-events-none absolute origin-top-left">
            <p style={{ height: LABEL_H }} className={`${PILL} max-w-full items-center px-2.5`}>
              <span className="truncate text-title font-semibold text-fg">{g.data.name}</span>
              {room >= ROOM_FOR_COUNT && <span className="text-label text-fg-subtle tabular-nums">{g.data.count}</span>}
            </p>
          </div>
        );
      })}
    </ViewportPortal>
  );
}
