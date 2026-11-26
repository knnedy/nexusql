export type SearchKind = "table" | "column" | "view" | "action";

export interface SearchItem {
  id: string;
  kind: SearchKind;
  label: string;
  /** Shown beside the label: a column's table, an action's shortcut. */
  detail?: string;
  /** Other words the item answers to. */
  keywords?: string;
}

// Among equal matches, tables come first.
const KIND_ORDER: Record<SearchKind, number> = { table: 0, view: 1, column: 2, action: 3 };

// Lower is better; null means no match.
function score(q: string, item: SearchItem): number | null {
  const label = item.label.toLowerCase();
  if (label === q) return 0;
  if (label.startsWith(q)) return 1;
  if (label.split(/[\s_.\-]+/).some((w) => w.startsWith(q))) return 2;
  if (label.includes(q)) return 3;
  if (item.keywords?.toLowerCase().includes(q)) return 4;
  return null;
}

/** Items matching query, best first; ties go by kind, then keep their order. Columns need a query. */
export function rankItems(query: string, items: SearchItem[]): SearchItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items.filter((i) => i.kind !== "column");
  return items
    .map((item, i) => ({ item, i, s: score(q, item) }))
    .filter((m): m is { item: SearchItem; i: number; s: number } => m.s !== null)
    .sort((a, b) => a.s - b.s || KIND_ORDER[a.item.kind] - KIND_ORDER[b.item.kind] || a.i - b.i)
    .map((m) => m.item);
}
