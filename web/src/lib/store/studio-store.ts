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

function readInitialSession(): {
  provider: DatabaseProvider;
  projectName: string;
} {
  if (typeof window === "undefined") {
    return { provider: "postgres", projectName: "Untitled" };
  }
  return {
    provider:
      (sessionStorage.getItem("nexusql_provider") as DatabaseProvider) ??
      "postgres",
    projectName: sessionStorage.getItem("nexusql_project_name") ?? "Untitled",
  };
}

const initialState = {
  viewMode: "diagram" as ViewMode,
  selectedTable: null,
  ...readInitialSession(),
};

export const useStudioStore = create<StudioState>((set) => ({
  ...initialState,

  setViewMode: (mode) => set({ viewMode: mode }),

  setSession: (provider, projectName) => set({ provider, projectName }),

  setSelectedTable: (name) => set({ selectedTable: name }),

  reset: () => set({ ...initialState, ...readInitialSession() }),
}));
