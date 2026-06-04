export type DatabaseProvider = "postgres" | "sqlite";

export type FieldType =
  // Numeric
  | "serial"
  | "bigserial"
  | "smallint"
  | "integer"
  | "bigint"
  | "numeric"
  | "real"
  | "double precision"
  // Character
  | "char"
  | "varchar"
  | "text"
  // Boolean
  | "boolean"
  // UUID
  | "uuid"
  // Date / Time
  | "date"
  | "time"
  | "timestamp"
  | "timestamptz"
  | "interval"
  // JSON
  | "json"
  | "jsonb"
  // Binary
  | "bytea"
  // Fallback for any provider-specific type not listed above
  | (string & {});

export type BadgeVariant = "teal" | "coral" | "gray";

// Maps a FieldType to its visual badge variant on the canvas node.
export const FIELD_TYPE_BADGE_MAP: Record<string, BadgeVariant> = {
  // Teal — relational / structural identity types
  serial: "teal",
  bigserial: "teal",
  uuid: "teal",
  integer: "teal",
  bigint: "teal",
  smallint: "teal",
  // Coral — text / character types
  varchar: "coral",
  text: "coral",
  char: "coral",
  // Gray — everything else
  boolean: "gray",
  numeric: "gray",
  real: "gray",
  "double precision": "gray",
  date: "gray",
  time: "gray",
  timestamp: "gray",
  timestamptz: "gray",
  interval: "gray",
  json: "gray",
  jsonb: "gray",
  bytea: "gray",
} as const;

// Schema structures
export interface Field {
  name: string;
  type: FieldType;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  defaultValue: string | null;
}

export interface Table {
  name: string;
  schema: string;
  fields: Field[];
}

export interface Relation {
  constraintName: string;
  sourceTable: string;
  sourceField: string;
  targetTable: string;
  targetField: string;
}

// API response shapes
export interface HealthResponse {
  status: "ok";
  version: string;
}

export interface ConnectRequest {
  uri: string;
}

export interface ConnectResponse {
  ok: boolean;
  provider: DatabaseProvider;
  error?: string;
}

export interface SchemaResponse {
  tables: Table[];
  relations: Relation[];
}

export interface RowsResponse {
  tableName: string;
  columns: string[];
  rows: Record<string, unknown>[];
}

// Project
export interface Project {
  id: string;
  name: string;
  uri: string;
  provider: DatabaseProvider;
  createdAt: string;
  lastOpenedAt: string;
}

// API response shapes for projects
export interface ProjectsResponse {
  projects: Project[];
}

export interface CreateProjectRequest {
  name: string;
  uri: string;
}

export interface CreateProjectResponse {
  project: Project;
}

// Canvas-specific derived types
export interface TableNodeData {
  table: Table;
  provider: DatabaseProvider;
  isSelected: boolean;
}

export interface RelationEdgeData {
  relation: Relation;
}
