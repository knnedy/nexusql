import { create } from "zustand";

interface CanvasFocus {
  hovered: string | null;
  selected: string | null;
  /** Each table's directly linked tables, either direction. */
  neighbours: Record<string, string[]>;
  setNeighbours: (neighbours: Record<string, string[]>) => void;
  setHovered: (table: string | null) => void;
  setSelected: (table: string | null) => void;
  reset: () => void;
}

/** The table in focus: hovered, else selected. Its edges stand out; hub lines show. */
export const useCanvasFocus = create<CanvasFocus>((set) => ({
  hovered: null,
  selected: null,
  neighbours: {},
  setNeighbours: (neighbours) => set({ neighbours }),
  setHovered: (hovered) => set({ hovered }),
  setSelected: (selected) => set({ selected }),
  reset: () => set({ hovered: null, selected: null, neighbours: {} }),
}));

/** Whether an edge between source and target is in focus, out of it, or nothing is. */
export function useEdgeFocus(source: string, target: string): "on" | "off" | "none" {
  return useCanvasFocus((s) => {
    const table = s.hovered ?? s.selected;
    if (table === null) return "none";
    return table === source || table === target ? "on" : "off";
  });
}

export type CardFocus = "selected" | "linked" | "faded" | "none";

export function cardFocus(table: string, selected: string | null, neighbours: Record<string, string[]>): CardFocus {
  if (selected === null) return "none";
  if (table === selected) return "selected";
  return neighbours[selected]?.includes(table) ? "linked" : "faded";
}

/** How a card shows the chosen table: picked out, linked to it, or faded behind. */
export const useCardFocus = (table: string) => useCanvasFocus((s) => cardFocus(table, s.selected, s.neighbours));

/** Whether a region holds the chosen table or one it links to; otherwise it fades with its cards. */
export const useRegionFaded = (tables: readonly string[]) =>
  useCanvasFocus((s) => s.selected !== null && tables.every((t) => cardFocus(t, s.selected, s.neighbours) === "faded"));
