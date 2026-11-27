"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { codeToHtml } from "shiki";
import { cx } from "@/shared/lib/cx";

/** SQL, highlighted in the current theme; plain text until the highlighter loads. */
export function SqlCode({ sql, wrap = false, className }: { sql: string; wrap?: boolean; className?: string }) {
  const { resolvedTheme } = useTheme();
  const [html, setHtml] = useState("");
  useEffect(() => {
    const theme = resolvedTheme === "dark" ? "github-dark-default" : "github-light-default";
    codeToHtml(sql, { lang: "sql", theme }).then(setHtml, () => setHtml(""));
  }, [sql, resolvedTheme]);
  const box = cx("overflow-x-auto text-label select-text", wrap && "[&_pre]:whitespace-pre-wrap [&_pre]:break-words", className);
  return html ? (
    <div className={cx(box, "[&>pre]:bg-sunk! [&>pre]:p-3")} dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <pre className={cx(box, "bg-sunk p-3 font-mono text-fg", wrap && "whitespace-pre-wrap break-words")}>{sql}</pre>
  );
}
