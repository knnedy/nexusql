export interface HistoryEntry {
  sql: string;
  ranAt: number;
}

/** The selection when there is one worth running, else the whole script; lines are 1-based. */
export function toRun(sql: string, start: number, end: number): { sql: string; lines: [number, number] | null } {
  const picked = sql.slice(Math.min(start, end), Math.max(start, end));
  if (!picked.trim()) return { sql, lines: null };
  // Lines of the selection's first and last non-blank characters.
  const from = Math.min(start, end) + (picked.length - picked.trimStart().length);
  const to = Math.min(start, end) + picked.trimEnd().length;
  const lineAt = (i: number) => sql.slice(0, i).split("\n").length;
  return { sql: picked.trim(), lines: [lineAt(from), lineAt(to)] };
}

/** Optimal string alignment distance: edits, with a swap of neighbours counting once. */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** A name from the SQL that a database error mentions, one or two typos from a real table. */
export function nearMiss(message: string, tables: string[], sql: string): { wrong: string; meant: string } | null {
  const known = new Set(tables.map((t) => t.toLowerCase()));
  const words = (message.match(/[A-Za-z_][\w$]*(?:\.[A-Za-z_][\w$]*)*/g) ?? []).flatMap((w) => w.split("."));
  let best: { wrong: string; meant: string; d: number } | null = null;
  for (const word of words) {
    // The error's own words ("table", "exist") never count: only names the SQL used.
    if (known.has(word.toLowerCase()) || errorLine(sql, word) === null) continue;
    const limit = Math.min(2, Math.floor(word.length / 3));
    for (const t of tables) {
      const d = distance(word.toLowerCase(), t.toLowerCase());
      if (d <= limit && (!best || d < best.d)) best = { wrong: word, meant: t, d };
    }
  }
  return best && { wrong: best.wrong, meant: best.meant };
}

/** The first line holding word as a whole identifier, 1-based. */
export function errorLine(sql: string, word: string): number | null {
  const re = new RegExp(`(^|[^\\w$])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\w$]|$)`, "i");
  const at = sql.split("\n").findIndex((line) => re.test(line));
  return at < 0 ? null : at + 1;
}

const NUMERIC = /\b(int\d?|integer|smallint|bigint|tinyint|mediumint|numeric|decimal|real|double|float\d?|serial|bigserial|smallserial|money)\b/;

/** Numbers line up on the right: by declared type, or by value when the type is unknown. */
export function isNumeric(type: string, value: unknown): boolean {
  return type ? NUMERIC.test(type) : typeof value === "number";
}

export const MIN_DOCK = 120;

export function clampHeight(height: number, max: number): number {
  return Math.round(Math.max(MIN_DOCK, Math.min(height, max)));
}

const historyKey = (project: string) => `nexusql.history.${project}`;

/** Queries run on a project, kept in this browser; empty when storage is unavailable. */
export function loadHistory(project: string | null): HistoryEntry[] {
  if (!project) return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(historyKey(project)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((e): e is HistoryEntry => typeof e?.sql === "string" && typeof e?.ranAt === "number") : [];
  } catch {
    return [];
  }
}

export function saveHistory(project: string | null, history: HistoryEntry[]): void {
  if (!project) return;
  try {
    localStorage.setItem(historyKey(project), JSON.stringify(history));
  } catch {
    // Private windows and full storage: history just won't survive a reload.
  }
}
