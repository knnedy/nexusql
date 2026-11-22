import type { EnumType, Field } from "@/shared/types/schema";

export type FilterOp =
  | "eq" | "ne" | "lt" | "lte" | "gt" | "gte"
  | "contains" | "startsWith" | "isNull" | "notNull" | "in";

/** One condition the rows endpoint applies; values are text, as the grid shows them. */
export interface RowFilter {
  column: string;
  op: FilterOp;
  values: string[];
}

export type FilterKind = "text" | "number" | "temporal" | "boolean" | "choice" | "json" | "other";

const NULL_OPS: FilterOp[] = ["isNull", "notNull"];
const RANGE_OPS: FilterOp[] = ["eq", "ne", "lt", "lte", "gt", "gte", ...NULL_OPS];
const CHOICE_OPS: FilterOp[] = ["eq", "ne", "in", ...NULL_OPS];

// Mirrors internal/studio/filters.go; the server rejects anything else.
const OPS: Record<FilterKind, FilterOp[]> = {
  text: ["eq", "ne", "contains", "startsWith", ...NULL_OPS],
  number: RANGE_OPS,
  temporal: RANGE_OPS,
  boolean: CHOICE_OPS,
  choice: CHOICE_OPS,
  json: NULL_OPS,
  other: ["eq", "ne", ...NULL_OPS],
};

const KIND_BY_TYPE: Record<string, FilterKind> = {
  char: "text", varchar: "text", text: "text", uuid: "text",
  smallint: "number", integer: "number", bigint: "number", serial: "number",
  bigserial: "number", numeric: "number", real: "number", "double precision": "number",
  date: "temporal", time: "temporal", timestamp: "temporal", timestamptz: "temporal",
  interval: "temporal",
  boolean: "boolean",
  json: "json", jsonb: "json",
};

export const OP_LABELS: Record<FilterOp, string> = {
  eq: "=", ne: "≠", lt: "<", lte: "≤", gt: ">", gte: "≥",
  contains: "contains", startsWith: "starts with",
  isNull: "is null", notNull: "is not null", in: "is one of",
};

export function kindOf(field: Field, enums: EnumType[]): FilterKind {
  if (field.allowed?.length || enums.some((e) => e.name === field.type)) {
    return "choice";
  }
  return KIND_BY_TYPE[field.type] ?? "other";
}

export function opsFor(kind: FilterKind): FilterOp[] {
  return OPS[kind];
}

/** The values a picker offers for field, or null when any text goes. */
export function choicesFor(field: Field, enums: EnumType[]): string[] | null {
  if (field.allowed?.length) return field.allowed;
  const e = enums.find((en) => en.name === field.type);
  if (e) return e.values;
  return field.type === "boolean" ? ["true", "false"] : null;
}

export function takesNoValue(op: FilterOp): boolean {
  return NULL_OPS.includes(op);
}

export function isComplete(f: RowFilter): boolean {
  if (takesNoValue(f.op)) return true;
  if (f.op === "in") return f.values.length > 0;
  return f.values.length === 1 && f.values[0] !== "";
}

export function describeFilter(f: RowFilter): string {
  const label = OP_LABELS[f.op];
  if (takesNoValue(f.op)) return `${f.column} ${label}`;
  if (f.op === "in") return `${f.column} ${label} ${f.values.join(", ")}`;
  if (f.op === "contains" || f.op === "startsWith") {
    return `${f.column} ${label} "${f.values[0]}"`;
  }
  return `${f.column} ${label} ${f.values[0]}`;
}

export function serializeFilters(filters: RowFilter[]): string {
  return filters.length ? JSON.stringify(filters) : "";
}

/** Reads the URL value, dropping anything malformed rather than failing. */
export function parseFilters(raw: string | null): RowFilter[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.filter(
    (f): f is RowFilter =>
      typeof f === "object" && f !== null &&
      typeof f.column === "string" &&
      typeof f.op === "string" && f.op in OP_LABELS &&
      Array.isArray(f.values) && f.values.every((v: unknown) => typeof v === "string"),
  );
}
