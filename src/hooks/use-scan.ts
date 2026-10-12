"use client";

import { useCallback, useRef, useState } from "react";
import { simulateHistory } from "@/lib/chart";
import type { PricePoint, Product } from "@/lib/types";

export type LogLevel = "info" | "ok" | "warn" | "error" | "ai";

export interface LogLine {
  ts: string;
  level: LogLevel;
  msg: string;
}

export type HistorySource = "live" | "simulated";

export interface History {
  points: PricePoint[];
  source: HistorySource;
}

const MIN_LIVE_POINTS = 2;

// Étapes réelles du scraper, affichées pendant l'attente de la réponse
const SCAN_STEPS: ReadonlyArray<{ delay: number; msg: string }> = [
  { delay: 0, msg: "Launching headless Chromium" },
  { delay: 600, msg: "Randomizing user-agent and viewport" },
  { delay: 1200, msg: "Loading product page" },
  { delay: 2500, msg: "Parsing title, price and stock" },
];

function timestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

async function fetchHistory(url: string): Promise<PricePoint[]> {
  try {
    const res = await fetch(`/api/history?url=${encodeURIComponent(url)}`);
    if (!res.ok) return [];
    const data: { points: PricePoint[] } = await res.json();
    return data.points;
  } catch {
    return [];
  }
}

export function useScan() {
  const [product, setProduct] = useState<Product | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const log = useCallback((level: LogLevel, msg: string) => {
    setLogs((prev) => [...prev, { ts: timestamp(), level, msg }]);
  }, []);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const scan = useCallback(
    async (url: string) => {
      if (!url || busy) return;
      clearTimers();
      setBusy(true);
      setError(null);
      setProduct(null);
      setHistory(null);
      setLogs([]);

      timers.current = SCAN_STEPS.map((s) => setTimeout(() => log("info", s.msg), s.delay));

      try {
        const res = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);
        clearTimers();
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const message: string = body.error || `Scan failed (${res.status})`;
          log("error", message);
          setError(message);
          return;
        }

        const data: Product = await res.json();
        if (data.source === "ai_fallback") {
          log("warn", "DOM selectors missed — markup drift detected");
          log("ai", "Gemini extracted the product from the reduced page");
        }
        log("ok", `Parsed “${data.name?.slice(0, 60) ?? "Unnamed product"}”`);
        setProduct(data);

        const live = await fetchHistory(data.url);
        if (live.length >= MIN_LIVE_POINTS) {
          log("info", `Loaded ${live.length} recorded price checks`);
          setHistory({ points: live, source: "live" });
        } else if (data.price !== null) {
          setHistory({ points: simulateHistory(data.price), source: "simulated" });
        }
      } catch (e) {
        clearTimers();
        const message = e instanceof Error ? e.message : "Network error";
        log("error", message);
        setError(message);
      } finally {
        setBusy(false);
      }
    },
    [busy, log],
  );

  const currentStep = busy ? (logs.at(-1)?.msg ?? SCAN_STEPS[0].msg) : null;

  return { product, history, logs, busy, error, currentStep, scan, log };
}
