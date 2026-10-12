"use client";

import { useState } from "react";
import { ActivityLog } from "@/components/activity-log";
import { AlertForm } from "@/components/alert-form";
import { LogoMark } from "@/components/logo";
import { PriceChart } from "@/components/price-chart";
import { ProductCard, ProductCardSkeleton } from "@/components/product-card";
import { ScanForm } from "@/components/scan-form";
import { SiteHeader } from "@/components/site-header";
import { useScan } from "@/hooks/use-scan";
import { percentChange } from "@/lib/chart";

const STACK = ["Next.js 16", "FastAPI", "Playwright", "Gemini 3.5 Flash", "PostgreSQL", "Resend"];

export default function Home() {
  const [url, setUrl] = useState("");
  const [target, setTarget] = useState<number | null>(null);
  const { product, history, logs, busy, error, currentStep, scan, log } = useScan();
  const change = history?.source === "live" ? percentChange(history.points) : null;

  const startScan = (nextUrl: string) => {
    setTarget(null);
    scan(nextUrl);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-14 sm:px-6 sm:pt-24">
        <section className="animate-rise max-w-3xl">
          <p className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-text-muted">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden />
            Amazon price intelligence
          </p>
          <h1 className="font-display mt-6 text-balance text-[3.25rem] leading-[0.95] tracking-tight sm:text-7xl">
            Buy at the <em className="text-brand pr-1">right moment.</em>
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-text-muted">
            Paste a product link. Kairos watches the price with a headless browser, falls back to
            Gemini when the page fights back, and emails you the moment it hits your target.
          </p>
        </section>

        <div className="animate-rise mt-10 max-w-2xl [animation-delay:80ms]">
          <ScanForm url={url} busy={busy} error={error} onUrlChange={setUrl} onScan={startScan} />
        </div>

        <div className="mt-14 grid gap-4 lg:grid-cols-5">
          {busy && (
            <div className="lg:col-span-3">
              <ProductCardSkeleton step={currentStep} />
            </div>
          )}

          {!busy && product && (
            <>
              <div className="lg:col-span-3">
                <ProductCard product={product} change={change} />
              </div>
              <div className="lg:col-span-2">
                <AlertForm
                  key={product.url}
                  product={product}
                  onLog={log}
                  onTargetChange={setTarget}
                />
              </div>
            </>
          )}

          {!busy && !product && (
            <div className="glass grid min-h-44 place-items-center rounded-2xl px-6 text-center lg:col-span-5">
              <div>
                <LogoMark className="mx-auto size-9 opacity-80" />
                <p className="mt-3 text-sm text-text-muted">
                  Your product shows up here. Paste a link or try an example.
                </p>
              </div>
            </div>
          )}
        </div>

        {!busy && history && (
          <div className="mt-4">
            <PriceChart key={product?.url} history={history} target={target} />
          </div>
        )}

        <div className="mt-4">
          <ActivityLog lines={logs} />
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 text-sm text-text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="flex items-center gap-2">
            <LogoMark className="size-5" />
            <span>
              <span className="font-display text-base italic text-text">Kairos</span> — καιρός, the
              opportune moment
            </span>
          </p>
          <p>{STACK.join(" · ")}</p>
        </div>
      </footer>
    </div>
  );
}
