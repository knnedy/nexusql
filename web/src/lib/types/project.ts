import type { DatabaseProvider } from "./provider";

export interface Project {
  id: string;
  name: string;
  uri: string;
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
