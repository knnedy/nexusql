import { Eye, HardDrive } from "lucide-react";

/** Where projects live and how writes are kept in check; plain facts, no promises. */
export function LocalNotes() {
  return (
    <ul className="mt-4 grid gap-2 px-1 text-label text-fg-subtle">
      <li className="flex gap-2">
        <HardDrive aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Projects are saved in <code className="font-mono text-caption text-fg-muted">~/.nexusql/projects.json</code>. Passwords are not
          encrypted yet.
        </span>
      </li>
      <li className="flex gap-2">
        <Eye aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        <span>Switch a connection to read-only from the workspace&apos;s top bar; the database itself then refuses writes.</span>
      </li>
    </ul>
  );
}
