"use client";

import { useState, useEffect } from "react";
import { X, Copy, Check, Download, FileCode, ImageIcon } from "lucide-react";
import { codeToHtml } from "shiki";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useTheme } from "next-themes";
import Image from "next/image";
import { QUERY_KEYS } from "@/lib/query-keys";

interface ExportPreviewDrawerProps {
  type: "png" | "prisma" | "drizzle" | null;
  sidebarOpen: boolean;
  onClose: () => void;
  pngDataUrl: string | null;
  isGeneratingPng: boolean;
  onGeneratePng: () => void;
}

const exportQueryOptions = (
  type: "png" | "prisma" | "drizzle" | null,
  enabled: boolean,
) =>
  queryOptions({
    queryKey: [QUERY_KEYS.export, type],
    queryFn: () =>
      type === "prisma" ? api.export.prisma() : api.export.drizzle(),
    enabled: enabled && !!type && type !== "png",
    staleTime: Infinity,
  });

function CodeBlock({
  code,
  lang,
}: {
  code: string;
  lang: "prisma" | "typescript";
}) {
  const [html, setHtml] = useState<string>("");
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const theme =
      resolvedTheme === "dark" ? "github-dark-default" : "github-light-default";
    codeToHtml(code, { lang, theme }).then(setHtml);
  }, [code, lang, resolvedTheme]);

  if (!html) {
    return (
      <div className="flex-1 rounded-xl bg-black/40 dark:bg-black/60 border border-node-border/60 dark:border-node-border/40 p-4 font-mono text-[11px] text-zinc-300 overflow-auto whitespace-pre leading-relaxed select-text tracking-normal">
        {code}
      </div>
    );
  }

  return (
    <div
      className="flex-1 rounded-xl overflow-auto border border-node-border/60 dark:border-node-border/40 text-[11px] leading-relaxed select-text [&>pre]:h-full [&>pre]:p-4 [&>pre]:rounded-xl [&>pre]:overflow-auto [&>pre]:text-[11px]! [&>pre]:font-mono!"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function ExportPreviewDrawer({
  type,
  sidebarOpen,
  onClose,
  isGeneratingPng,
  onGeneratePng,
  pngDataUrl,
}: ExportPreviewDrawerProps) {
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery(exportQueryOptions(type, sidebarOpen));

  useEffect(() => {
    if (type === "png" && sidebarOpen) {
      onGeneratePng();
    }
  }, [type, sidebarOpen, onGeneratePng]);

  if (!type || !sidebarOpen) return null;

  const payload = data?.schema ?? "";

  const handleCopy = () => {
    if (type === "png" || !payload) return;
    navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (type === "png") {
      if (!pngDataUrl) return;
      const link = document.createElement("a");
      link.href = pngDataUrl;
      link.download = "schema.png";
      link.click();
      return;
    }
    const blob = new Blob([payload], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `schema.${type === "prisma" ? "prisma" : "ts"}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="absolute top-0 bottom-0 h-full w-120 z-20 flex flex-col border-r border-node-border/80 dark:border-node-border/40 bg-node-bg/90 dark:bg-node-bg/95 backdrop-blur-md shadow-2xl transition-all duration-300 ease-out animate-in slide-in-from-left-12"
      style={{ left: "18rem" }}>
      <div className="flex items-center justify-between px-4 py-4 bg-node-header-bg/20 border-b border-node-border/60 dark:border-node-border/30 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {type === "png" ? (
            <ImageIcon size={14} className="text-teal" />
          ) : (
            <FileCode size={14} className="text-blue-400" />
          )}
          <span className="text-[12px] font-bold text-text-primary capitalize tracking-normal antialiased">
            {type === "png" ? "Snapshot Preview" : `${type} Code`}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {type !== "png" && (
            <button
              onClick={handleCopy}
              className="flex items-center justify-center w-7 h-7 rounded-md text-text-tertiary hover:text-text-primary hover:bg-node-border/40 transition-colors border-none bg-transparent cursor-pointer">
              {copied ? (
                <Check size={13} className="text-teal" />
              ) : (
                <Copy size={13} />
              )}
            </button>
          )}
          <button
            onClick={handleDownload}
            disabled={type === "png" && (isGeneratingPng || !pngDataUrl)}
            className="flex items-center justify-center w-7 h-7 rounded-md text-text-tertiary hover:text-text-primary hover:bg-node-border/40 transition-colors border-none bg-transparent cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
            <Download size={13} />
          </button>
          <div className="w-px h-4 bg-node-border/60 mx-1" />
          <button
            onClick={onClose}
            className="flex items-center justify-center w-6 h-6 rounded-md text-text-tertiary hover:text-text-primary hover:bg-node-border/40 transition-colors border-none bg-transparent cursor-pointer">
            <X size={12} aria-hidden />
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto min-h-0 flex flex-col">
        {type === "png" ? (
          <div className="flex-1 flex items-center justify-center rounded-xl bg-black/10 dark:bg-black/30 border border-dashed border-node-border/80 p-4 overflow-hidden">
            {isGeneratingPng ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-teal border-t-transparent animate-spin" />
                <span className="text-[11px] text-text-tertiary font-mono">
                  Rendering snapshot…
                </span>
              </div>
            ) : pngDataUrl ? (
              <Image
                src={pngDataUrl}
                alt="Canvas snapshot"
                className="max-w-full max-h-full rounded-lg border border-node-border/40 shadow-md object-contain"
              />
            ) : (
              <span className="text-[11px] text-text-tertiary font-mono">
                No preview yet
              </span>
            )}
          </div>
        ) : isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-4 h-4 rounded-full border-2 border-teal border-t-transparent animate-spin" />
          </div>
        ) : (
          <CodeBlock
            code={payload}
            lang={type === "prisma" ? "prisma" : "typescript"}
          />
        )}
      </div>
    </div>
  );
}
