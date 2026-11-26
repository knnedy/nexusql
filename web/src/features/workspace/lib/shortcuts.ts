export type Shortcut = "search" | "sidebar" | "sql" | "filter";

const CHORDS: Record<string, Shortcut> = { k: "search", b: "sidebar", j: "sql" };

function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.getAttribute("contenteditable") === "true" || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** The workspace shortcut a key press asks for, if any. */
export function shortcutFor(e: KeyboardEvent): Shortcut | null {
  if (e.altKey || e.shiftKey) return null;
  if (e.ctrlKey || e.metaKey) return CHORDS[e.key.toLowerCase()] ?? null;
  if (e.key === "/" && !typing(e.target)) return "filter";
  return null;
}
