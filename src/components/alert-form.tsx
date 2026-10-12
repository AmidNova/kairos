"use client";

import { useState, type FormEvent } from "react";
import { Bell, CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

const SUGGESTED_DISCOUNT = 0.9;

type Status = "idle" | "submitting" | "armed";

interface AlertFormProps {
  product: Product;
  onLog: (level: "info" | "ok" | "error", msg: string) => void;
  /** Prévisualise la cible sur le graphique pendant la saisie. */
  onTargetChange: (target: number | null) => void;
}

export function AlertForm({ product, onLog, onTargetChange }: AlertFormProps) {
  const [email, setEmail] = useState("");
  const [target, setTarget] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const suggested =
    product.price !== null ? (product.price * SUGGESTED_DISCOUNT).toFixed(2) : "0.00";
  const targetValue = Number.parseFloat(target);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(targetValue) || targetValue <= 0) {
      setError("Enter a target price above 0 €");
      return;
    }
    setStatus("submitting");
    setError(null);
    onLog("info", `Creating alert at ${formatPrice(targetValue)} for ${email}`);

    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, target_price: targetValue, product }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      onLog("ok", "Alert armed — daily check at 08:00 UTC");
      setStatus("armed");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      onLog("error", message);
      setError(message);
      setStatus("idle");
    }
  };

  if (status === "armed") {
    return (
      <section className="glass animate-rise h-full rounded-2xl p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success-soft text-success">
            <CircleCheck className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-2xl leading-none">Alert is live</h2>
            <p className="mt-1 text-sm leading-relaxed text-text-muted">
              We&apos;ll email <span className="font-medium text-text">{email}</span> when the
              price drops to <span className="tabular font-medium text-text">{formatPrice(targetValue)}</span> or
              less. Prices are checked daily at 08:00 UTC.
            </p>
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="mt-3 text-sm font-medium text-text-muted underline-offset-4 hover:text-text hover:underline"
            >
              Change target
            </button>
          </div>
        </div>
      </section>
    );
  }

  const inputClass =
    "h-11 w-full rounded-xl border border-border bg-glass-strong px-3.5 text-sm outline-none transition placeholder:text-text-subtle focus:border-accent focus:ring-4 focus:ring-ring/25";

  return (
    <section className="glass animate-rise h-full rounded-2xl p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Bell className="size-4 text-accent" aria-hidden />
        <h2 className="font-display text-2xl leading-none">Price alert</h2>
      </div>
      <p className="mt-1 text-sm text-text-muted">Get an email when it drops to your target.</p>

      <form onSubmit={submit} className="mt-4 space-y-3" noValidate={false}>
        <div>
          <label htmlFor="alert-email" className="mb-1.5 block text-xs font-medium text-text-muted">
            Email
          </label>
          <input
            id="alert-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="alert-target" className="mb-1.5 flex items-baseline justify-between text-xs font-medium text-text-muted">
            Target price
            <span className="font-normal text-text-subtle">previewed on the chart</span>
          </label>
          <div className="relative">
            <input
              id="alert-target"
              type="number"
              required
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                const value = Number.parseFloat(e.target.value);
                onTargetChange(Number.isFinite(value) && value > 0 ? value : null);
              }}
              placeholder={suggested}
              className={`${inputClass} tabular pr-8`}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-subtle">
              €
            </span>
          </div>
        </div>

        {error && (
          <p role="alert" className="flex items-center gap-2 text-sm text-danger">
            <CircleAlert className="size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={status === "submitting" || !email || !target}
          className="btn-brand inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "submitting" && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          Create alert
        </button>
      </form>
    </section>
  );
}
