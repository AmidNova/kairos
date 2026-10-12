import Image from "next/image";
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleCheck,
  CircleX,
  CodeXml,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { formatPercent, formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

// Sous 0,05 %, l'arrondi affiche 0.0 % : pas de flèche ni de couleur
const FLAT_THRESHOLD = 0.05;

interface ProductCardProps {
  product: Product;
  change: number | null;
}

export function ProductCard({ product, change }: ProductCardProps) {
  const inStock = product.in_stock !== false;
  const isAi = product.source === "ai_fallback";

  return (
    <article className="glass animate-rise flex h-full flex-col rounded-2xl p-5 sm:p-6">
      <div className="flex gap-4">
        <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-white p-2 ring-1 ring-border sm:size-24">
          {product.image ? (
            <Image
              src={product.image}
              alt=""
              width={96}
              height={96}
              className="size-full object-contain"
              unoptimized
            />
          ) : (
            <span className="text-xs text-text-subtle">No image</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 text-[15px] font-medium leading-snug">
            {product.name ?? "Unnamed product"}
          </h2>
          <a
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-sm text-text-muted underline-offset-4 hover:text-text hover:underline"
          >
            View on Amazon
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-text-subtle">
            Current price
          </p>
          <p className="font-display tabular mt-1 text-5xl leading-none sm:text-6xl">
            {product.price !== null ? formatPrice(product.price) : "—"}
          </p>
        </div>
        {change !== null && <ChangeBadge change={change} />}
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4 text-xs font-medium">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
            inStock ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
          }`}
        >
          {inStock ? (
            <CircleCheck className="size-3.5" aria-hidden />
          ) : (
            <CircleX className="size-3.5" aria-hidden />
          )}
          {inStock ? "In stock" : "Out of stock"}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
            isAi ? "bg-accent-soft text-text" : "bg-surface-muted text-text-muted"
          }`}
          title={
            isAi
              ? "CSS selectors missed; Gemini extracted the data from the page"
              : "Extracted by the DOM parser"
          }
        >
          {isAi ? (
            <Sparkles className="size-3.5 text-accent" aria-hidden />
          ) : (
            <CodeXml className="size-3.5" aria-hidden />
          )}
          {isAi ? "AI fallback" : "DOM parser"}
        </span>
      </div>
    </article>
  );
}

function ChangeBadge({ change }: { change: number }) {
  const flat = Math.abs(change) < FLAT_THRESHOLD;
  const down = change < 0;
  const tone = flat
    ? "bg-surface-muted text-text-muted"
    : down
      ? "bg-success-soft text-success"
      : "bg-danger-soft text-danger";

  return (
    <span
      className={`tabular inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium ${tone}`}
      title="Change since the first recorded check"
    >
      {!flat &&
        (down ? (
          <ArrowDownRight className="size-4" aria-hidden />
        ) : (
          <ArrowUpRight className="size-4" aria-hidden />
        ))}
      {flat ? "No change" : formatPercent(change)}
      <span className="sr-only">since first check</span>
    </span>
  );
}

export function ProductCardSkeleton({ step }: { step: string | null }) {
  return (
    <div className="glass rounded-2xl p-5 sm:p-6" aria-busy="true" aria-live="polite">
      <div className="flex gap-4">
        <div className="size-20 shrink-0 animate-pulse rounded-xl bg-surface-muted sm:size-24" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 w-4/5 animate-pulse rounded bg-surface-muted" />
          <div className="h-4 w-2/5 animate-pulse rounded bg-surface-muted" />
        </div>
      </div>
      <div className="mt-6 h-12 w-44 animate-pulse rounded-lg bg-surface-muted" />
      <p className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-sm text-text-muted">
        <span className="size-1.5 animate-pulse rounded-full bg-accent" aria-hidden />
        {step ?? "Starting…"}
      </p>
    </div>
  );
}
