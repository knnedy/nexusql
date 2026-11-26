"use client";

import { Fragment } from "react";
import { cx } from "@/shared/lib/cx";
import type { Relation } from "@/shared/types/schema";
import { trailHops, type Trail } from "../lib/trail";

/** The tables followed to get here; each one is a way back. */
export function RelationshipTrail({ trail, relations, onSelect }: { trail: Trail; relations: Relation[]; onSelect: (table: string) => void }) {
  if (trail.tables.length < 2) return null;
  const hops = trailHops(trail, relations);
  return (
    <nav aria-label="Relationship trail" className="flex min-w-0 items-center overflow-x-auto py-1">
      {trail.tables.map((t, i) => (
        <Fragment key={t}>
          {i > 0 && (
            <span className="mx-1.5 flex shrink-0 flex-col items-center" aria-label={`by ${hops[i - 1]}`}>
              <span className="mb-0.5 font-mono text-caption leading-none text-fg-subtle">{hops[i - 1]}</span>
              <span aria-hidden className="trail-line relative h-0.5 w-9 bg-relation-line" />
            </span>
          )}
          <button
            type="button"
            aria-current={i === trail.at ? "location" : undefined}
            onClick={() => onSelect(t)}
            className={cx(
              "h-7 shrink-0 cursor-pointer rounded-full border px-2.75 text-body font-medium transition-colors duration-150",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              i === trail.at
                ? "border-accent-line bg-accent-tint text-accent"
                : "border-relation-faint bg-relation-tint text-relation hover:border-relation-line",
            )}>
            {t}
          </button>
        </Fragment>
      ))}
    </nav>
  );
}
