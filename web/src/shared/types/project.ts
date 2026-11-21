import type { DatabaseProvider } from "@/shared/types/provider";

export interface Project {
  id: string;
  name: string;
  /** Connection URI with secrets masked by the server; the real one never leaves it. */
  displayUri: string;
  provider: DatabaseProvider;
  createdAt: string;
  lastOpenedAt: string;
}

export interface ProjectsResponse {
  projects: Project[];
}

export interface CreateProjectRequest {
  name: string;
  uri: string;
  provider: DatabaseProvider;
}

export interface CreateProjectResponse {
  project: Project;
}
