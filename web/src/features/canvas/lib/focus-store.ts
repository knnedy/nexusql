import { create } from "zustand";

interface CanvasFocus {
  hovered: string | null;
  selected: string | null;
  setHovered: (table: string | null) => void;
  setSelected: (table: string | null) => void;
  reset: () => void;
}

/** The table in focus: hovered, else selected. Its edges stand out; hub lines show. */
export const useCanvasFocus = create<CanvasFocus>((set) => ({
  hovered: null,
  selected: null,
  setHovered: (hovered) => set({ hovered }),
  setSelected: (selected) => set({ selected }),
  reset: () => set({ hovered: null, selected: null }),
}));

/** Whether an edge between source and target is in focus, out of it, or nothing is. */
export function useEdgeFocus(source: string, target: string): "on" | "off" | "none" {
  return useCanvasFocus((s) => {
    const table = s.hovered ?? s.selected;
    if (table === null) return "none";
    return table === source || table === target ? "on" : "off";
  });
}
