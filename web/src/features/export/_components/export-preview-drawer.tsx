"use client";

import { useState, useEffect } from "react";
import { X, Copy, Check, Download, ImageIcon } from "lucide-react";
import { codeToHtml } from "shiki";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  exportFormatsQueryOptions,
  exportQueryOptions,
  PNG_EXPORT,
} from "@/shared/hooks/use-export";
import { studioSession } from "@/shared/lib/session-storage";
import { FormatIcon, formatTint } from "./format-icon";

interface ExportPreviewDrawerProps {
  /** A server format id, or the canvas snapshot. */
  type: string | null;
  sidebarOpen: boolean;
  onClose: () => void;
  pngDataUrl: string | null;
  isGeneratingPng: boolean;
  onGeneratePng: () => void;
}

function CodeBlock({
  code,
  lang,
}: {
  code: string;
  lang: string;
}) {
  const [html, setHtml] = useState<string>("");
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const theme =
      resolvedTheme === "dark" ? "github-dark-default" : "github-light-default";
    // An unknown language keeps the plain-text fallback below.
    codeToHtml(code, { lang, theme }).then(setHtml, () => setHtml(""));
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
  const { data: formats } = useQuery(exportFormatsQueryOptions());
  const format = formats?.find((f) => f.id === type);
  const isPng = type === PNG_EXPORT;
  const provider = studioSession.provider() ?? "postgres";

  useEffect(() => {
    if (type === PNG_EXPORT && sidebarOpen) {
      onGeneratePng();
    }
  }, [type, sidebarOpen, onGeneratePng]);

  if (!type || !sidebarOpen) return null;

  const payload = data?.schema ?? "";

  const handleCopy = () => {
    if (isPng || !payload) return;
    navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (isPng) {
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
    link.download = format?.filename ?? `schema.${type}`;
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
          {isPng ? (
            <ImageIcon size={14} className="text-teal" />
          ) : (
            <span className={`flex items-center justify-center w-6 h-6 rounded-md ${formatTint(type, provider)}`}>
              <FormatIcon id={type} provider={provider} size={13} />
            </span>
          )}
          <span className="text-[12px] font-bold text-text-primary tracking-normal antialiased">
            {isPng ? "Snapshot Preview" : (format?.label ?? type)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {!isPng && (
            <button
              onClick={handleCopy}
              aria-label="Copy export"
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
            aria-label="Download export"
            disabled={isPng && (isGeneratingPng || !pngDataUrl)}
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
        {isPng ? (
          <div className="flex-1 flex items-center justify-center rounded-xl bg-black/10 dark:bg-black/30 border border-dashed border-node-border/80 p-4 overflow-hidden">
            {isGeneratingPng ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-teal border-t-transparent animate-spin" />
                <span className="text-[11px] text-text-tertiary font-mono">
                  Rendering snapshot…
                </span>
              </div>
            ) : pngDataUrl ? (
              // An in-memory snapshot of unknown size: nothing for next/image to optimise.
              // eslint-disable-next-line @next/next/no-img-element
              <img
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
          <CodeBlock code={payload} lang={format?.language ?? "text"} />
        )}
      </div>
    </div>
  );
}
