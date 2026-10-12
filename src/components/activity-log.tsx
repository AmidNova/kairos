"use client";

import { useEffect, useRef } from "react";
import { ChevronRight } from "lucide-react";
import type { LogLevel, LogLine } from "@/hooks/use-scan";

const LEVEL_STYLE: Record<LogLevel, string> = {
  info: "bg-surface-muted text-text-muted",
  ok: "bg-success-soft text-success",
  warn: "bg-accent-soft text-text",
  error: "bg-danger-soft text-danger",
  ai: "bg-accent-soft text-text",
};

export function ActivityLog({ lines }: { lines: LogLine[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [lines.length]);

  if (lines.length === 0) return null;

  return (
    <details className="glass group rounded-2xl">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="size-4 text-text-subtle transition-transform group-open:rotate-90"
          aria-hidden
        />
        Activity log
        <span className="tabular rounded-full bg-surface-muted px-2 py-0.5 text-xs text-text-muted">
          {lines.length}
        </span>
        <span className="ml-auto hidden font-mono text-xs text-text-subtle sm:inline">/dev/scraper</span>
      </summary>
      <div className="max-h-64 overflow-y-auto border-t border-border px-5 py-3 font-mono text-xs">
        {lines.map((l, i) => (
          <div key={i} className="flex items-baseline gap-3 py-1">
            <span className="tabular shrink-0 text-text-subtle">{l.ts}</span>
            <span
              className={`w-11 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-semibold uppercase ${LEVEL_STYLE[l.level]}`}
            >
              {l.level}
            </span>
            <span className="min-w-0 break-words text-text-muted">{l.msg}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </details>
  );
}
