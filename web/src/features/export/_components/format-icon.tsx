import type { ReactNode, SVGProps } from "react";
import { FileCode } from "lucide-react";
import {
  SiDrizzle,
  SiGo,
  SiMermaid,
  SiMysql,
  SiPostgresql,
  SiPrisma,
  SiSqlalchemy,
  SiSqlite,
  SiTypeorm,
} from "react-icons/si";
import type { DatabaseProvider } from "@/shared/types/provider";

type GlyphProps = SVGProps<SVGSVGElement> & { size?: number };

// Kysely's logo (kysely-org/kysely, MIT): its K in a rounded square, one colour.
function KyselyMark({ size = 14, ...props }: GlyphProps) {
  return (
    <svg viewBox="0 0 132 132" width={size} height={size} fill="none" {...props}>
      <rect x="6" y="6" width="120" height="120" rx="20" stroke="currentColor" strokeWidth="12" />
      <path fill="currentColor" stroke="currentColor" strokeWidth="6" d="M41.2983 109V23.9091H46.4918V73.31H47.0735L91.9457 23.9091H98.8427L61.9062 64.1694L98.5103 109H92.0288L58.5824 67.9087L46.4918 81.2873V109H41.2983Z" />
    </svg>
  );
}

// DBML's logo (holistics/dbml, Apache-2.0) without its tile: database and code mark, one colour.
function DbmlMark({ size = 14, ...props }: GlyphProps) {
  return (
    <svg viewBox="30 33 148 142" width={size} height={size} fill="none" {...props}>
      <path fill="currentColor" d="M36 127.061V150.073C36 157.665 62.2412 168.691 103.359 168.691C144.477 168.691 170.718 157.665 170.718 150.073V127.061C156.866 136.091 130.019 140.764 103.359 140.764C76.6994 140.764 49.8519 136.091 36 127.061Z" />
      <path fill="currentColor" d="M36.2816 85.0696V110.74C36.2816 118.331 62.5228 129.358 103.641 129.358C144.759 129.358 171 118.331 171 110.74V85.0696C158.11 94.9886 133.37 101.431 103.641 101.431C73.9113 101.431 49.1712 94.9886 36.2816 85.0696Z" />
      <path stroke="currentColor" strokeWidth="12" strokeLinecap="round" d="M110.325 39L96.9414 88.9488" />
      <path fill="currentColor" stroke="currentColor" strokeWidth="2.8" d="M76.0788 79.0563L76.1295 79.0778L76.1818 79.0952C76.6384 79.2474 77.1121 79.3453 77.5869 79.3453C78.3673 79.3453 79.06 79.0323 79.5813 78.4636C80.1521 77.8409 80.3414 77.0538 80.3414 76.3057V75.4146C80.3414 74.664 80.1448 73.9445 79.7086 73.3157C79.2796 72.6971 78.678 72.251 77.9991 71.9352L77.9702 71.9217L77.9406 71.9096L58.5427 63.942L77.8989 56.0527C78.6245 55.8015 79.2552 55.3654 79.703 54.714C80.1456 54.0702 80.3414 53.3334 80.3414 52.5664V51.6396C80.3414 50.8915 80.1521 50.1044 79.5813 49.4817C79.06 48.913 78.3673 48.6 77.5869 48.6C77.1121 48.6 76.6384 48.6979 76.1818 48.8501L76.1288 48.8677L76.0773 48.8896L50.0568 59.9394L50.0461 59.944L50.0354 59.9487C49.3386 60.2584 48.7157 60.6978 48.268 61.3146C47.8103 61.9452 47.6 62.6735 47.6 63.438V64.543C47.6 65.3074 47.8103 66.0358 48.268 66.6663C48.7157 67.2832 49.3386 67.7226 50.0354 68.0323L50.0468 68.0373L50.0583 68.0422L76.0788 79.0563Z" />
      <path fill="currentColor" stroke="currentColor" strokeWidth="2.8" d="M131.188 79.0563L131.137 79.0778L131.085 79.0952C130.628 79.2474 130.154 79.3453 129.68 79.3453C128.899 79.3453 128.207 79.0323 127.685 78.4636C127.114 77.8409 126.925 77.0538 126.925 76.3057V75.4146C126.925 74.664 127.122 73.9445 127.558 73.3157C127.987 72.6971 128.589 72.251 129.267 71.9352L129.296 71.9217L129.326 71.9096L148.724 63.942L129.368 56.0527C128.642 55.8015 128.011 55.3654 127.564 54.714C127.121 54.0702 126.925 53.3334 126.925 52.5664V51.6396C126.925 50.8915 127.114 50.1044 127.685 49.4817C128.207 48.913 128.899 48.6 129.68 48.6C130.154 48.6 130.628 48.6979 131.085 48.8501L131.138 48.8677L131.189 48.8896L157.21 59.9394L157.221 59.944L157.231 59.9487C157.928 60.2584 158.551 60.6978 158.999 61.3146C159.456 61.9452 159.667 62.6735 159.667 63.438V64.543C159.667 65.3074 159.456 66.0358 158.999 66.6663C158.551 67.2832 157.928 67.7226 157.231 68.0323L157.22 68.0373L157.208 68.0422L131.188 79.0563Z" />
    </svg>
  );
}

interface Mark {
  icon: (size: number) => ReactNode;
  tint: string; // wrapper background and colour, light and dark
}

const SQL_MARKS: Record<DatabaseProvider, Mark> = {
  postgres: {
    icon: (s) => <SiPostgresql size={s} aria-hidden />,
    tint: "bg-sky-600/10 text-sky-700 dark:bg-sky-400/10 dark:text-sky-400",
  },
  mysql: {
    icon: (s) => <SiMysql size={s} aria-hidden />,
    tint: "bg-orange-500/10 text-orange-600 dark:bg-orange-400/10 dark:text-orange-400",
  },
  sqlite: {
    icon: (s) => <SiSqlite size={s} aria-hidden />,
    tint: "bg-sky-800/10 text-sky-800 dark:bg-sky-300/10 dark:text-sky-300",
  },
};

const MARKS: Record<string, Mark> = {
  prisma: {
    icon: (s) => <SiPrisma size={s} aria-hidden />,
    tint: "bg-indigo-500/5 text-indigo-500 dark:bg-indigo-400/10 dark:text-indigo-400",
  },
  drizzle: {
    icon: (s) => <SiDrizzle size={s} aria-hidden />,
    tint: "bg-lime-500/10 text-lime-600 dark:bg-lime-400/10 dark:text-lime-400",
  },
  kysely: {
    icon: (s) => <KyselyMark size={s} aria-hidden />,
    tint: "bg-surface-3 text-text-primary dark:bg-surface-3/50",
  },
  sqlalchemy: {
    icon: (s) => <SiSqlalchemy size={s} aria-hidden />,
    tint: "bg-red-600/10 text-red-700 dark:bg-red-400/10 dark:text-red-400",
  },
  // GORM has no icon of its own (user, 2026-11-23): Go's logo stands in.
  gorm: {
    icon: (s) => <SiGo size={s} aria-hidden />,
    tint: "bg-cyan-500/10 text-cyan-600 dark:bg-cyan-400/10 dark:text-cyan-400",
  },
  typeorm: {
    icon: (s) => <SiTypeorm size={s} aria-hidden />,
    tint: "bg-rose-500/10 text-rose-600 dark:bg-rose-400/10 dark:text-rose-400",
  },
  dbml: {
    icon: (s) => <DbmlMark size={s} aria-hidden />,
    tint: "bg-blue-600/10 text-blue-700 dark:bg-blue-400/10 dark:text-blue-400",
  },
  mermaid: {
    icon: (s) => <SiMermaid size={s} aria-hidden />,
    tint: "bg-pink-500/10 text-pink-600 dark:bg-pink-400/10 dark:text-pink-400",
  },
};

const FALLBACK: Mark = {
  icon: (s) => <FileCode size={s} aria-hidden data-fallback />,
  tint: "bg-surface-3 text-text-secondary dark:bg-surface-3/50",
};

function markFor(id: string, provider: DatabaseProvider): Mark {
  if (id === "sql") return SQL_MARKS[provider] ?? FALLBACK;
  return MARKS[id] ?? FALLBACK;
}

/** The export format's brand mark; SQL takes the connected database's. */
export function FormatIcon({ id, provider, size = 14 }: { id: string; provider: DatabaseProvider; size?: number }) {
  return <>{markFor(id, provider).icon(size)}</>;
}

/** Classes for the tile behind a FormatIcon. */
export function formatTint(id: string, provider: DatabaseProvider): string {
  return markFor(id, provider).tint;
}
