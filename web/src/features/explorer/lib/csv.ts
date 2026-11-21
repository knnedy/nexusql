import { toCsv } from "@/shared/lib/csv";

export function exportToCsv(
  tableName: string,
  columns: string[],
  rows: Record<string, unknown>[],
  columnVisibility: Record<string, boolean>,
): void {
  const visibleColumns = columns.filter(
    (col) => columnVisibility[col] !== false,
  );

  // The BOM tells Excel the file is UTF-8; without it non-ASCII text is garbled.
  const csv = "\uFEFF" + toCsv(visibleColumns, rows);
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
