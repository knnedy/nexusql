// Spreadsheets run cells starting with these as formulas (OWASP CSV injection).
const FORMULA_START = /^[=+\-@\t\r]/;
// Plain numbers are read as numbers, not formulas, so -5 stays -5.
const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const NEEDS_QUOTES = /[",\r\n]/;

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (FORMULA_START.test(s) && !NUMBER.test(s)) s = `'${s}`;
  return NEEDS_QUOTES.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180 CSV with a header row; NULL is an empty cell, objects are JSON. */
export function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const lines = [columns, ...rows.map((row) => columns.map((col) => row[col]))];
  return lines.map((line) => line.map(cell).join(",")).join("\n");
}
