export const VIEWS = ["diagram", "data", "structure", "export"] as const;
export type View = (typeof VIEWS)[number];

/** The view the URL asks for; the diagram when it names none we know. */
export function parseView(param: string | null): View {
  return (VIEWS as readonly string[]).includes(param ?? "") ? (param as View) : "diagram";
}

export type Updates = Record<string, string | number | null>;

/** The query string after applying updates; null or "" removes a key. */
export function nextSearch(current: URLSearchParams, updates: Updates): string {
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  return next.toString();
}

/** Choosing a table starts its data fresh: no paging, sorting, search or filters. */
export function selectTableUpdates(table: string): Updates {
  return { table, page: null, sort: null, dir: null, search: null, filters: null };
}
