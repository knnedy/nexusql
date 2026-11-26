import { SiMysql, SiPostgresql, SiSqlite } from "react-icons/si";
import { cx } from "@/shared/lib/cx";
import type { DatabaseProvider } from "@/shared/types/provider";

// Brand marks in brand-leaning colours, tuned per theme for contrast.
const MARKS: Record<DatabaseProvider, { Icon: typeof SiPostgresql; tint: string }> = {
  postgres: { Icon: SiPostgresql, tint: "text-sky-700 dark:text-sky-400" },
  mysql: { Icon: SiMysql, tint: "text-orange-600 dark:text-orange-400" },
  sqlite: { Icon: SiSqlite, tint: "text-sky-800 dark:text-sky-300" },
};

/** The database's logo; decorative, so name the database beside it. */
export function ProviderMark({ provider, size = 18, className }: { provider: DatabaseProvider; size?: number; className?: string }) {
  const { Icon, tint } = MARKS[provider];
  return <Icon size={size} aria-hidden className={cx("shrink-0", tint, className)} />;
}
