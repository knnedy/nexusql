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
export const FIELD_TYPE_BADGE_MAP: Record<FieldType, BadgeVariant> = {
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

export interface EnumType {
  name: string;
  values: string[];
}

export interface SchemaResponse {
  tables: Table[];
  relations: Relation[];
  enums: EnumType[];
}
