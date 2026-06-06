import type { DatabaseProvider } from "@/lib/types";

export default function ProviderBadge({
  provider,
}: {
  provider: DatabaseProvider;
}) {
  const styles = {
    postgres: "bg-badge-teal-bg text-badge-teal-text",
    mysql: "bg-badge-blue-bg text-badge-blue-text",
    sqlite: "bg-badge-gray-bg text-badge-gray-text",
  } as const satisfies Record<DatabaseProvider, string>;

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium shrink-0 ${styles[provider]}`}>
      {provider}
    </span>
  );
}
