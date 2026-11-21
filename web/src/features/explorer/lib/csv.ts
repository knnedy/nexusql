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
