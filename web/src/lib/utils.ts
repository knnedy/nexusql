import { parseISO, formatDistanceToNowStrict } from "date-fns";
import { DatabaseProvider, FieldType } from "./types";

export function formatRelativeTime(iso: string): string {
  if (!iso || typeof iso !== "string") {
    return "Unknown date";
  }

  try {
    const date = parseISO(iso);

    if (isNaN(date.getTime())) {
      return "Unknown date";
    }

    const distance = formatDistanceToNowStrict(date, { addSuffix: true });

    return distance
      .replace(" seconds ago", "s ago")
      .replace(" second ago", "s ago")
      .replace(" minutes ago", "m ago")
      .replace(" minute ago", "m ago")
      .replace(" hours ago", "h ago")
      .replace(" hour ago", "h ago")
      .replace(" days ago", "d ago")
      .replace(" day ago", "d ago")
      .replace(" months ago", "mo ago")
      .replace(" month ago", "mo ago")
      .replace("in 0 seconds", "Just now")
      .replace("0 seconds ago", "Just now");
  } catch (error) {
    console.error("Error formatting relative time:", error);
    return "Unknown date";
  }
}

export function normalizeFieldType(
  rawType: string,
  provider: DatabaseProvider,
): FieldType {
  const sanitized = rawType.toLowerCase().trim();

  // Shared Base Mappings across all engines
  const sharedMap: Record<string, FieldType> = {
    int: "integer",
    integer: "integer",
    bigint: "bigint",
    smallint: "smallint",
    tinyint: "smallint",
    decimal: "numeric",
    numeric: "numeric",
    float: "real",
    double: "double precision",
    varchar: "varchar",
    char: "char",
    text: "text",
    bool: "boolean",
    boolean: "boolean",
    date: "date",
    time: "time",
    timestamp: "timestamp",
    datetime: "timestamp",
    json: "json",
    blob: "bytea",
    clob: "text",
  };

  if (sharedMap[sanitized]) return sharedMap[sanitized];

  // PostgreSQL Overrides
  if (provider === "postgres") {
    const pgMap: Record<string, FieldType> = {
      int4: "integer",
      int8: "bigint",
      int2: "smallint",
      float4: "real",
      float8: "double precision",
      bpchar: "char",
      "character varying": "varchar",
      character: "char",
      "timestamp without time zone": "timestamp",
      "timestamp with time zone": "timestamptz",
      "time without time zone": "time",
    };
    if (pgMap[sanitized]) return pgMap[sanitized];
  }

  // MySQL Overrides
  if (provider === "mysql") {
    if (sanitized === "tinyint(1)" || sanitized === "tinyint1") {
      return "boolean";
    }
    const mysqlMap: Record<string, FieldType> = {
      mediumint: "integer",
      longtext: "text",
      mediumtext: "text",
      tinytext: "varchar",
      longblob: "bytea",
      mediumblob: "bytea",
      fixed: "numeric",
    };
    if (mysqlMap[sanitized]) return mysqlMap[sanitized];
  }

  // SQLite Affinity Fallbacks
  if (provider === "sqlite") {
    const baseAffinity = sanitized.match(/^[a-z]+/)?.[0] || sanitized;
    const sqliteMap: Record<string, FieldType> = {
      int: "integer",
      integer: "integer",
      real: "double precision",
      text: "text",
      blob: "bytea",
    };
    if (sqliteMap[baseAffinity]) return sqliteMap[baseAffinity];
  }

  // Fallback for custom user domains/extensions
  return sanitized as FieldType;
}

export function exportToCsv(
  tableName: string,
  columns: string[],
  rows: Record<string, unknown>[],
  columnVisibility: Record<string, boolean>,
): void {
  const visibleColumns = columns.filter(
    (col) => columnVisibility[col] !== false,
  );

  function escapeCsvCell(value: unknown): string {
    if (value === null || value === undefined) return "";
    const str =
      typeof value === "object" ? JSON.stringify(value) : String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  const header = visibleColumns.join(",");
  const body = rows
    .map((row) =>
      visibleColumns.map((col) => escapeCsvCell(row[col])).join(","),
    )
    .join("\n");

  const csv = `${header}\n${body}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${tableName}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
