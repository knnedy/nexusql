import type { Table, Relation } from "@/shared/types/schema";
import type { DatabaseProvider } from "@/shared/types/provider";

export interface TableNodeData extends Record<string, unknown> {
  table: Table;
  provider: DatabaseProvider;
  isSelected: boolean;
  /** Columns some foreign key references; each gets a target handle. */
  referenced: string[];
}

export interface RelationEdgeData extends Record<string, unknown> {
  relation: Relation;
  sourceY?: number;
  targetY?: number;
  /** ELK's orthogonal route, from source handle to target handle. */
  points?: { x: number; y: number }[];
}
