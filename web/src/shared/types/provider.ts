export type DatabaseProvider = "postgres" | "sqlite" | "mysql";

export type OrmTarget = "prisma" | "drizzle";

export interface ProviderMeta {
  id: DatabaseProvider;
  label: string;
  uriPlaceholder: string;
  uriPrefixes: string[];
}

export const PROVIDERS: ProviderMeta[] = [
  {
    id: "postgres",
    label: "PostgreSQL",
    uriPlaceholder: "postgres://user:pass@localhost:5432/dbname",
    uriPrefixes: ["postgres://", "postgresql://"],
  },
  {
    id: "mysql",
    label: "MySQL",
    uriPlaceholder: "mysql://user:pass@localhost:3306/dbname",
    uriPrefixes: ["mysql://"],
  },
  {
    id: "sqlite",
    label: "SQLite",
    uriPlaceholder: "sqlite:///absolute/path/to/file.db",
    uriPrefixes: ["sqlite://"],
  },
] as const;
