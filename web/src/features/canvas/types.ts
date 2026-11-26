import type { Table, Relation } from "@/shared/types/schema";
import type { DatabaseProvider } from "@/shared/types/provider";

export interface TableNodeData extends Record<string, unknown> {
  table: Table;
  provider: DatabaseProvider;
  isSelected: boolean;
  /** Columns some foreign key references; each gets a target handle. */
  referenced: string[];
  /** FK columns whose lines hide behind a chip (into a hub, or out of the group), to the table they reference. */
  chips?: Record<string, string>;
  /** The id of the group region the table sits in. */
  group?: string;
}

export interface GroupNodeData extends Record<string, unknown> {
  name: string;
  count: number;
  unlinked?: true;
}

export interface RelationEdgeData extends Record<string, unknown> {
  relation: Relation;
  sourceY?: number;
  targetY?: number;
  /** ELK's orthogonal route, from source handle to target handle. */
  points?: { x: number; y: number }[];
  /** Into a hub table: left out of the layout, drawn only while either end is in focus. */
  hub?: boolean;
  /** Joins two groups: left out of the layout, drawn only while either end is in focus. */
  cross?: boolean;
}
