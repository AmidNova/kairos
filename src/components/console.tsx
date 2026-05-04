"use client";

import { useEffect, useRef } from "react";

export interface LogLine {
  ts: string;
  level: "INFO" | "OK" | "WARN" | "ERR" | "AI";
  msg: string;
}

const levelColor: Record<LogLine["level"], string> = {
  INFO: "text-text-dim",
  OK: "text-green",
  WARN: "text-amber",
  ERR: "text-red",
  AI: "text-amber glow-amber",
};

interface Props {
  lines: LogLine[];
  busy: boolean;
}

export function Console({ lines, busy }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines.length]);

  return (
    <div className="border border-border-strong bg-bg-deep h-full">
      <div className="border-b border-border-strong px-3 py-2 flex items-center justify-between">
        <span className="text-xs text-amber-dim tracking-widest uppercase">
          Console
        </span>
        <span className="text-xs text-amber-faint">/dev/scraper</span>
      </div>
      <div className="p-3 overflow-y-auto max-h-80 text-xs leading-relaxed">
        {lines.length === 0 ? (
          <div className="text-amber-faint">
            <span className="text-amber-dim">$</span> awaiting target
            <span className="blink"> _</span>
          </div>
        ) : (
          lines.map((l, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-amber-faint shrink-0">[{l.ts}]</span>
              <span className={`${levelColor[l.level]} shrink-0 w-10`}>
                {l.level}
              </span>
              <span className="text-text">{l.msg}</span>
            </div>
          ))
        )}
        {busy && (
          <div className="text-amber mt-1">
            <span className="blink">█</span>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
