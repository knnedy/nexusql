import { create } from "zustand";
import type { DatabaseProvider } from "@/lib/types";

export type ViewMode = "diagram" | "data";

interface StudioState {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  provider: DatabaseProvider;
  projectName: string;
  setSession: (provider: DatabaseProvider, projectName: string) => void;

  selectedTable: string | null;
  setSelectedTable: (name: string | null) => void;

  reset: () => void;
}

const initialState = {
  viewMode: "diagram" as ViewMode,
  provider: "postgres" as DatabaseProvider,
  projectName: "Untitled",
  selectedTable: null,
};

export const useStudioStore = create<StudioState>((set) => ({
  ...initialState,

  setViewMode: (mode) => set({ viewMode: mode }),

  setSession: (provider, projectName) => set({ provider, projectName }),

  setSelectedTable: (name) => set({ selectedTable: name }),

  reset: () => set(initialState),
}));
