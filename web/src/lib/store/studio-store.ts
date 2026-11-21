import { create } from "zustand";
import { DatabaseProvider } from "@/shared/types/provider";
import { studioSession } from "@/shared/lib/session-storage";

interface StudioState {
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
      studioSession.provider() ??
      "postgres",
    projectName: studioSession.projectName() ?? "Untitled",
  };
}

const initialState = {
  selectedTable: null,
  ...readInitialSession(),
};

export const useStudioStore = create<StudioState>((set) => ({
  ...initialState,

  setSession: (provider, projectName) => set({ provider, projectName }),

  setSelectedTable: (name) => set({ selectedTable: name }),

  reset: () => set({ ...initialState, ...readInitialSession() }),
}));
