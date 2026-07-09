import type { Table, Relation } from "./schema";
import type { DatabaseProvider } from "./provider";

export interface TableNodeData extends Record<string, unknown> {
  table: Table;
  provider: DatabaseProvider;
  isSelected: boolean;
}

export interface RelationEdgeData extends Record<string, unknown> {
  relation: Relation;
  sourceY?: number;
  targetY?: number;
}
