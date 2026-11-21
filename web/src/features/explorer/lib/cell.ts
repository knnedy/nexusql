/** The text a cell shows and edits; null for SQL NULL, so "" stays a real value. */
export function cellText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Whether next is what the cell already held, so saving it would change nothing. */
export function isUnchanged(original: unknown, next: string | null): boolean {
  return cellText(original) === next;
}
