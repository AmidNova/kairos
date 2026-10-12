"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Wordmark } from "./logo";

type ScraperStatus = "checking" | "up" | "down";

const STATUS_LABEL: Record<ScraperStatus, string> = {
  checking: "Checking scraper…",
  up: "Scraper online",
  down: "Scraper offline",
};

const STATUS_DOT: Record<ScraperStatus, string> = {
  checking: "bg-text-subtle",
  up: "bg-success",
  down: "bg-danger",
};

export function SiteHeader() {
  const [status, setStatus] = useState<ScraperStatus>("checking");

  useEffect(() => {
    let active = true;
    fetch("/api/health")
      .then((r) => r.json())
      .then((d: { scraper?: string }) => active && setStatus(d.scraper === "up" ? "up" : "down"))
      .catch(() => active && setStatus("down"));
    return () => {
      active = false;
    };
  }, []);

  return (
    <header className="sticky top-3 z-30 px-3 sm:top-4 sm:px-6">
      <div className="glass mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 rounded-2xl pl-3 pr-2 sm:pl-4">
        <Link href="/" aria-label="Kairos home" className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          <Wordmark />
        </Link>

        <div
          className="flex items-center gap-2 rounded-xl bg-surface-muted px-3 py-1.5 text-xs font-medium text-text-muted"
          role="status"
        >
          <span className="relative flex size-2">
            {status === "up" && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-40" />
            )}
            <span className={`relative inline-flex size-2 rounded-full ${STATUS_DOT[status]}`} />
          </span>
          {STATUS_LABEL[status]}
        </div>
      </div>
    </header>
  );
}
