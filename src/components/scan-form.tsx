"use client";

import { ArrowRight, CircleAlert, Link as LinkIcon, LoaderCircle } from "lucide-react";
import type { FormEvent } from "react";

const EXAMPLES = [
  { label: "Kindle Paperwhite", url: "https://www.amazon.fr/dp/B0CFPWLGF2" },
  { label: "Kindle 16 Go", url: "https://www.amazon.fr/dp/B0G4SHPH5K" },
];

interface ScanFormProps {
  url: string;
  busy: boolean;
  error: string | null;
  onUrlChange: (url: string) => void;
  onScan: (url: string) => void;
}

export function ScanForm({ url, busy, error, onUrlChange, onScan }: ScanFormProps) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onScan(url.trim());
  };

  const tryExample = (exampleUrl: string) => {
    onUrlChange(exampleUrl);
    onScan(exampleUrl);
  };

  return (
    <div>
      <form
        onSubmit={submit}
        className="glass flex items-center gap-2 rounded-2xl p-1.5 transition focus-within:ring-4 focus-within:ring-ring/25"
      >
        <label htmlFor="product-url" className="sr-only">
          Amazon product URL
        </label>
        <LinkIcon className="ml-3 size-4 shrink-0 text-text-subtle" aria-hidden />
        <input
          id="product-url"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="Paste an Amazon product link"
          disabled={busy}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "scan-error" : undefined}
          className="h-11 min-w-0 flex-1 bg-transparent font-mono text-sm outline-none placeholder:font-sans placeholder:text-text-subtle disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !url.trim()}
          className="btn-brand inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 sm:px-5"
        >
          {busy ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
          ) : (
            <ArrowRight className="size-4" aria-hidden />
          )}
          <span>{busy ? "Scanning" : "Scan"}</span>
        </button>
      </form>

      {error ? (
        <p
          id="scan-error"
          role="alert"
          className="glass mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-danger"
        >
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-text-muted">
          <span className="mr-1">Try</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.url}
              type="button"
              disabled={busy}
              onClick={() => tryExample(ex.url)}
              className="glass rounded-full px-3.5 py-1.5 text-text transition hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
            >
              {ex.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
